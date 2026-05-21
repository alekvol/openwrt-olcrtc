#!/bin/sh
# ══════════════════════════════════════════════════════════════
#  OlcRTC OpenWrt — установка одной командой
#  Использование:
#    sh -c "$(wget -qO- https://raw.githubusercontent.com/alekvol/openwrt-olcrtc/master/install.sh)"
# ══════════════════════════════════════════════════════════════
set -e

GITHUB_REPO="alekvol/openwrt-olcrtc"
PKG_VERSION="0.1.2-1"
TMP_DIR="/tmp/olcrtc-install"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[!!]${NC} %s\n" "$*"; }
error() { printf "${RED}[ERR]${NC} %s\n" "$*"; exit 1; }

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║     Установка olcRTC для OpenWrt      ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── Проверки ──────────────────────────────────────────────────
command -v wget  >/dev/null 2>&1 || error "wget не найден"
command -v uci   >/dev/null 2>&1 || error "uci не найден. Это не OpenWrt?"

# ── Определяем архитектуру ────────────────────────────────────
ARCH=$(uname -m)
case "$ARCH" in
	aarch64)
		PKG_ARCH="aarch64_cortex-a53"
		info "Архитектура: $ARCH ($PKG_ARCH)"
		;;
	x86_64)
		PKG_ARCH="x86_64"
		info "Архитектура: $ARCH ($PKG_ARCH)"
		;;
	armv7l|armv7)
		PKG_ARCH="arm_cortex-a7_neon-vfpv4"
		warn "Архитектура ARM32: $ARCH — поддержка ограничена"
		;;
	*)
		error "Неподдерживаемая архитектура: $ARCH (поддерживаются aarch64, x86_64)"
		;;
esac

# ── Определяем пакетный менеджер ──────────────────────────────
if [ -f /etc/openwrt_release ]; then
	RELEASE=$(. /etc/openwrt_release; echo "$DISTRIB_RELEASE")
	info "OpenWrt версия: $RELEASE"
else
	warn "Файл /etc/openwrt_release не найден, пробую определить менеджер пакетов"
	RELEASE="unknown"
fi

PKG_MGR=""
PKG_EXT=""
if command -v apk >/dev/null 2>&1; then
	PKG_MGR="apk"
	PKG_EXT="apk"
	info "Пакетный менеджер: apk"
elif command -v opkg >/dev/null 2>&1; then
	PKG_MGR="opkg"
	PKG_EXT="ipk"
	info "Пакетный менеджер: opkg"
else
	error "Не найден ни apk, ни opkg. Это не OpenWrt?"
fi

# ── Скачиваем пакеты ─────────────────────────────────────────
BASE_URL="https://github.com/$GITHUB_REPO/releases/latest/download"
mkdir -p "$TMP_DIR"

PKGS="olcrtc_${PKG_VERSION}_${PKG_ARCH}.${PKG_EXT}"
PKGS_ALL="olcrtc-tun2socks_${PKG_VERSION}_all.${PKG_EXT} luci-app-olcrtc_${PKG_VERSION}_all.${PKG_EXT} luci-i18n-olcrtc-ru_${PKG_VERSION}_all.${PKG_EXT}"

echo ""
info "Скачиваем пакеты..."

for pkg in $PKGS $PKGS_ALL; do
	printf "  ↓ $pkg ... "
	if wget -q -O "$TMP_DIR/$pkg" "$BASE_URL/$pkg" 2>/dev/null; then
		printf "${GREEN}OK${NC}\n"
	else
		printf "${RED}FAIL${NC}\n"
		error "Не удалось скачать $pkg с $BASE_URL/$pkg"
	fi
done

# ── Устанавливаем зависимости ─────────────────────────────────
echo ""
info "Устанавливаем зависимости..."

DEPS="hev-socks5-tunnel kmod-tun ca-bundle curl ip-full"

if [ "$PKG_MGR" = "apk" ]; then
	apk update 2>/dev/null || warn "apk update завершился с ошибкой (возможно нет интернета)"
	for dep in $DEPS; do
		printf "  → $dep ... "
		if apk add "$dep" >/dev/null 2>&1; then
			printf "${GREEN}OK${NC}\n"
		else
			printf "${YELLOW}пропущено${NC}\n"
		fi
	done
else
	opkg update 2>/dev/null || warn "opkg update завершился с ошибкой"
	for dep in $DEPS; do
		printf "  → $dep ... "
		if opkg install "$dep" >/dev/null 2>&1; then
			printf "${GREEN}OK${NC}\n"
		else
			printf "${YELLOW}пропущено${NC}\n"
		fi
	done
fi

# ── Устанавливаем пакеты olcRTC ───────────────────────────────
echo ""
info "Устанавливаем пакеты olcRTC..."

if [ "$PKG_MGR" = "apk" ]; then
	for pkg in $PKGS $PKGS_ALL; do
		printf "  → $pkg ... "
		if apk add --allow-untrusted "$TMP_DIR/$pkg" >/dev/null 2>&1; then
			printf "${GREEN}OK${NC}\n"
		else
			printf "${RED}FAIL${NC}\n"
			warn "Ошибка установки $pkg (продолжаем)"
		fi
	done
else
	for pkg in $PKGS $PKGS_ALL; do
		printf "  → $pkg ... "
		if opkg install "$TMP_DIR/$pkg" >/dev/null 2>&1; then
			printf "${GREEN}OK${NC}\n"
		else
			printf "${RED}FAIL${NC}\n"
			warn "Ошибка установки $pkg (продолжаем)"
		fi
	done
fi

# ── Включаем сервисы ──────────────────────────────────────────
echo ""
info "Включаем сервисы..."

if [ -f /etc/init.d/olcrtc ]; then
	/etc/init.d/olcrtc enable 2>/dev/null && info "olcrtc включён в автозагрузку"
fi
if [ -f /etc/init.d/olcrtc-tun ]; then
	/etc/init.d/olcrtc-tun enable 2>/dev/null && info "olcrtc-tun включён в автозагрузку"
fi

# ── Делаем rpcd-плагин исполняемым ────────────────────────────
if [ -f /usr/libexec/rpcd/olcrtc ]; then
	chmod 755 /usr/libexec/rpcd/olcrtc
fi

# ── Перезапускаем LuCI ────────────────────────────────────────
info "Перезапускаем rpcd и uhttpd..."
/etc/init.d/rpcd   restart 2>/dev/null || warn "rpcd не перезапущен"
/etc/init.d/uhttpd restart 2>/dev/null || warn "uhttpd не перезапущен"

# ── Очистка ───────────────────────────────────────────────────
rm -rf "$TMP_DIR"
info "Временные файлы удалены"

echo ""
echo "╔═════════════════════════════════════════════════════╗"
echo "║  Установка завершена!                               ║"
echo "║                                                     ║"
echo "║  Откройте LuCI → Службы → olcRTC                   ║"
echo "║  Заполните Room ID, Client ID и ключ,               ║"
echo "║  затем нажмите Сохранить и Применить.                ║"
echo "║                                                     ║"
echo "║  Удаление:                                          ║"
echo "║  sh -c \"\$(wget -qO- https://raw.githubusercontent.  ║"
echo "║  com/alekvol/openwrt-olcrtc/master/uninstall.sh)\"   ║"
echo "╚═════════════════════════════════════════════════════╝"
echo ""

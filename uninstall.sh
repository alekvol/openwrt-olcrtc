#!/bin/sh
# ══════════════════════════════════════════════════════════════
#  OlcRTC OpenWrt — удаление
#  Использование:
#    sh -c "$(wget -qO- https://raw.githubusercontent.com/alekvol/openwrt-olcrtc/master/uninstall.sh)"
# ══════════════════════════════════════════════════════════════
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[!!]${NC} %s\n" "$*"; }

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║     Удаление olcRTC для OpenWrt       ║"
echo "╚═══════════════════════════════════════╝"
echo ""

# ── Останавливаем сервисы ─────────────────────────────────────
if [ -f /etc/init.d/olcrtc-tun ]; then
	/etc/init.d/olcrtc-tun stop 2>/dev/null || true
	/etc/init.d/olcrtc-tun disable 2>/dev/null || true
	info "olcrtc-tun остановлен и отключён"
fi

if [ -f /etc/init.d/olcrtc ]; then
	/etc/init.d/olcrtc stop 2>/dev/null || true
	/etc/init.d/olcrtc disable 2>/dev/null || true
	info "olcrtc остановлен и отключён"
fi

# ── Удаляем firewall-правила (если были настроены) ────────────
echo ""
info "Удаляем firewall-правила..."

# Remove forwarding lan -> olc
idx=0
while uci -q get "firewall.@forwarding[$idx]" >/dev/null 2>&1; do
	fsrc=$(uci -q get "firewall.@forwarding[$idx].src" || true)
	fdst=$(uci -q get "firewall.@forwarding[$idx].dest" || true)
	if [ "$fsrc" = "lan" ] && [ "$fdst" = "olc" ]; then
		uci delete "firewall.@forwarding[$idx]" 2>/dev/null
		info "Удалено forwarding lan → olc"
		break
	fi
	idx=$((idx + 1))
done

# Remove firewall zone 'olc'
idx=0
while uci -q get "firewall.@zone[$idx]" >/dev/null 2>&1; do
	zname=$(uci -q get "firewall.@zone[$idx].name" || true)
	if [ "$zname" = "olc" ]; then
		uci delete "firewall.@zone[$idx]" 2>/dev/null
		info "Удалена firewall zone 'olc'"
		break
	fi
	idx=$((idx + 1))
done

uci commit firewall 2>/dev/null || true

# ── Удаляем сетевой интерфейс ─────────────────────────────────
if uci -q get network.olctun >/dev/null 2>&1; then
	uci delete network.olctun 2>/dev/null
	uci commit network 2>/dev/null
	info "Удалён сетевой интерфейс olctun"
fi

# ── Очищаем маршруты ──────────────────────────────────────────
ip rule del lookup 100 2>/dev/null || true
ip route flush table 100 2>/dev/null || true
info "Маршруты table 100 очищены"

# ── Удаляем пакеты ────────────────────────────────────────────
echo ""
info "Удаляем пакеты..."

PKGS="luci-i18n-olcrtc-ru luci-app-olcrtc olcrtc-tun2socks olcrtc"

if command -v apk >/dev/null 2>&1; then
	for pkg in $PKGS; do
		if apk info -e "$pkg" >/dev/null 2>&1; then
			apk del "$pkg" >/dev/null 2>&1 && info "Удалён: $pkg" || warn "Не удалось удалить: $pkg"
		fi
	done
elif command -v opkg >/dev/null 2>&1; then
	for pkg in $PKGS; do
		if opkg status "$pkg" 2>/dev/null | grep -q "Status.*installed"; then
			opkg remove "$pkg" >/dev/null 2>&1 && info "Удалён: $pkg" || warn "Не удалось удалить: $pkg"
		fi
	done
fi

# ── Удаляем оставшиеся файлы (если пакетный менеджер не удалил) ──
rm -f /etc/config/olcrtc 2>/dev/null
rm -f /etc/config/olcrtc-tun 2>/dev/null
rm -f /usr/libexec/rpcd/olcrtc 2>/dev/null

# ── Перезапускаем сервисы ─────────────────────────────────────
echo ""
info "Перезапускаем сервисы..."
/etc/init.d/network reload 2>/dev/null  || warn "network не перезапущен"
/etc/init.d/firewall restart 2>/dev/null || warn "firewall не перезапущен"
/etc/init.d/rpcd restart 2>/dev/null     || warn "rpcd не перезапущен"
/etc/init.d/uhttpd restart 2>/dev/null   || warn "uhttpd не перезапущен"

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║     olcRTC полностью удалён!          ║"
echo "╚═══════════════════════════════════════╝"
echo ""

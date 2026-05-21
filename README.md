# openwrt-olcrtc

OpenWrt feed для запуска [olcRTC](https://github.com/openlibrecommunity/olcrtc)
клиента на роутере и раздачи через него интернета Wi-Fi-клиентам по
схеме `LAN → tun → SOCKS5 (olcrtc) → WebRTC carrier`.

Поддерживаемые таргеты (рекомендуется): **aarch64_cortex-a53** (MT7981B / Filogic 820),
**x86_64**, **aarch64_generic**.

Версия OpenWrt: **25.12** (рекомендуется, текущий стабильный, пакет-менеджер `apk`)
или **24.10** (старый стабильный, `opkg`) или **SNAPSHOT**.

## Состав

| Пакет | Назначение |
|---|---|
| `olcrtc` | сам бинарник olcRTC, init-скрипт `procd`, UCI-конфиг `/etc/config/olcrtc`, встроенный watchdog |
| `olcrtc-tun2socks` | поднимает TUN-интерфейс и натравливает его на локальный SOCKS5 от olcrtc (через `hev-socks5-tunnel`) |
| `luci-app-olcrtc` | веб-морда LuCI для правки UCI-конфигов |
| `luci-i18n-olcrtc-ru` | русский перевод LuCI-приложения (собирается автоматически вместе с `luci-app-olcrtc`) |

## Быстрая установка (одной командой)

Подключитесь к роутеру по SSH и выполните:

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/alekvol/openwrt-olcrtc/master/install.sh)"
```

Скрипт автоматически определит архитектуру и пакетный менеджер, скачает пакеты
из GitHub Releases и установит все зависимости. После установки откройте
**LuCI → Службы → olcRTC**.

### Быстрый старт через URI

Если сервер выдал строку подключения вида `olcrtc://…` — вставьте её в поле
**«Быстрое подключение»** на вкладке Client, все параметры заполнятся сами.

### Подписки

Вставьте `https://…` ссылку на sub.md-файл — появятся карточки серверов,
клик по карточке применяет настройки одним нажатием.

### Удаление

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/alekvol/openwrt-olcrtc/master/uninstall.sh)"
```

---

## Подключение feed

В `feeds.conf.default` или `feeds.conf` корня OpenWrt buildroot:

```
src-git olcrtc https://github.com/alekvol/openwrt-olcrtc.git
```

Затем:

```
./scripts/feeds update olcrtc
./scripts/feeds install -a -p olcrtc
make menuconfig    # Network -> olcrtc, olcrtc-tun2socks ; LuCI -> 3.applications -> luci-app-olcrtc
make package/olcrtc/compile V=s
```

## Готовые пакеты без сборки

GitHub Actions workflow `build.yml` собирает пакеты под `aarch64_cortex-a53`
(Filogic 820 / MT7981B). По умолчанию целевая версия — **25.12.3** (выходной
формат — `.apk`). Артефакты доступны во вкладке Actions, а на тегах
публикуются в Releases.

Чтобы пересобрать под 24.10 (формат `.ipk`) — Run workflow → openwrt_version = `24.10.6`.

## Установка на роутере

### OpenWrt 25.12 (apk)

```
apk update
apk add ./olcrtc-*.apk ./olcrtc-tun2socks-*.apk \
        ./luci-app-olcrtc-*.apk ./luci-i18n-olcrtc-ru-*.apk
apk add hev-socks5-tunnel kmod-tun ca-bundle curl
```

### OpenWrt 24.10 (opkg)

```
opkg update
opkg install ./olcrtc_*.ipk ./olcrtc-tun2socks_*.ipk \
             ./luci-app-olcrtc_*.ipk ./luci-i18n-olcrtc-ru_*.ipk
opkg install hev-socks5-tunnel kmod-tun ca-bundle curl
```

## Настройка

1. Получить от сервера: `room_id`, `client_id`, `key`, `carrier`, `transport`.
2. Заполнить `/etc/config/olcrtc` (или через LuCI).
3. Включить мост tun→socks: `/etc/config/olcrtc-tun`.
4. Применить настройки сети и firewall (см. `docs/routing.md` ниже).

```
uci set olcrtc.main.enabled=1
uci set olcrtc.main.room_id='...'
uci set olcrtc.main.key='...'
uci commit olcrtc
/etc/init.d/olcrtc enable
/etc/init.d/olcrtc start

uci set olcrtc-tun.main.enabled=1
uci commit olcrtc-tun
/etc/init.d/olcrtc-tun enable
/etc/init.d/olcrtc-tun start
```

## Маршрутизация Wi-Fi/LAN-клиентов через olcrtc

После старта появляется интерфейс `olctun` с адресом `198.18.0.1/15`.
Дальше — два варианта.

### Вариант A: весь LAN через olcrtc

```
uci set network.olctun=interface
uci set network.olctun.proto='none'
uci set network.olctun.device='olctun'
uci set network.olctun.auto='1'

uci add firewall zone
uci rename firewall.@zone[-1]='olc'
uci set firewall.olc.input='REJECT'
uci set firewall.olc.output='ACCEPT'
uci set firewall.olc.forward='REJECT'
uci set firewall.olc.masq='1'
uci set firewall.olc.mtu_fix='1'
uci add_list firewall.olc.network='olctun'

uci add firewall forwarding
uci set firewall.@forwarding[-1].src='lan'
uci set firewall.@forwarding[-1].dest='olc'

uci add network rule
uci set network.@rule[-1].in='br-lan'
uci set network.@rule[-1].lookup='100'
uci add network route
uci set network.@route[-1].interface='olctun'
uci set network.@route[-1].target='0.0.0.0/0'
uci set network.@route[-1].table='100'

uci commit
/etc/init.d/network reload
/etc/init.d/firewall restart
```

### Вариант Б: выборочно по доменам/IP

Использовать `dnsmasq` + nftables set и заворачивать только нужные
домены в таблицу 100 (см. `docs/selective.md`).

## Watchdog

Внутри пакета `olcrtc` лежит `/usr/libexec/olcrtc-watchdog.sh`, который
запускается отдельным procd-инстансом. Он периодически (по умолчанию раз
в 30 с) дёргает probe-URL через **собственный** SOCKS5 olcrtc и считает
провалом всё, что не вернуло HTTP 2xx/3xx. После `max_fails` неудач
подряд — `/etc/init.d/olcrtc restart`.

Включается в `/etc/config/olcrtc`:

```
config watchdog 'watchdog'
    option enabled    '1'
    option probe_url  'https://www.google.com/generate_204'
    option interval   '30'
    option timeout    '10'
    option max_fails  '3'
```

Логи: `logread -e olcrtc-watchdog`.

## Ограничения

- olcRTC написан на Go 1.25+, бинарник тяжёлый (≈ 30–50 MB). Нужен
  таргет с минимум 128 MB RAM и достаточным flash (или extroot/USB).
- MT7981B (256/512 MB DDR на типовых платах) тянет хорошо, но CPU
  будет занят DTLS/SRTP — не ждите гигабит.
- Только pure-Go вариант `cmd/olcrtc`. Вариант `cmd/olcrtc-cgo`
  требует CGO и не собирается из этого feed.

## Лицензия

WTFPL для самого olcRTC. Файлы этого feed-репозитория — MIT, см. LICENSE.

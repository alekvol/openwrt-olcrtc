# openwrt-olcrtc

OpenWrt feed для запуска [olcRTC](https://github.com/openlibrecommunity/olcrtc)
клиента на роутере и раздачи через него интернета Wi-Fi-клиентам по
схеме `LAN → tun → SOCKS5 (olcrtc) → WebRTC carrier`.

Поддерживаемые таргеты (рекомендуется): **aarch64_cortex-a53** (MT7981B / Filogic 820),
**x86_64**, **aarch64_generic**.

Версия OpenWrt: **24.10 / SNAPSHOT** (Go 1.23+ в host SDK).

## Состав

| Пакет | Назначение |
|---|---|
| `olcrtc` | сам бинарник olcRTC, init-скрипт `procd`, UCI-конфиг `/etc/config/olcrtc` |
| `olcrtc-tun2socks` | поднимает TUN-интерфейс и натравливает его на локальный SOCKS5 от olcrtc (через `hev-socks5-tunnel`) |
| `luci-app-olcrtc` | веб-морда LuCI для правки UCI-конфигов |

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

## Готовые ipk без сборки

Если в репозитории включён GitHub Actions workflow `build.yml`, артефакты
собираются под `aarch64_cortex-a53` (Filogic 820 / MT7981B) и публикуются в Releases.

## Установка на роутере

```
opkg update
opkg install olcrtc olcrtc-tun2socks luci-app-olcrtc \
             hev-socks5-tunnel kmod-tun ca-bundle
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

## Ограничения

- olcRTC написан на Go 1.25+, бинарник тяжёлый (≈ 30–50 MB). Нужен
  таргет с минимум 128 MB RAM и достаточным flash (или extroot/USB).
- MT7981B (256/512 MB DDR на типовых платах) тянет хорошо, но CPU
  будет занят DTLS/SRTP — не ждите гигабит.
- Только pure-Go вариант `cmd/olcrtc`. Вариант `cmd/olcrtc-cgo`
  требует CGO и не собирается из этого feed.

## Лицензия

WTFPL для самого olcRTC. Файлы этого feed-репозитория — MIT, см. LICENSE.

# Маршрутизация Wi-Fi/LAN-клиентов через olcrtc

После старта `olcrtc-tun` появляется L3-интерфейс (по умолчанию `olctun`,
адрес `198.18.0.1/15`). Дальше нужно решить, **что именно** через него
гнать.

## 1. Весь LAN через olcrtc (полный VPN-режим)

Самый простой способ — включить `auto_route` в `/etc/config/olcrtc-tun`:

```
uci set olcrtc-tun.main.auto_route='1'
uci commit olcrtc-tun
/etc/init.d/olcrtc-tun restart
```

Init-скрипт добавит:

```
ip rule add iif br-lan lookup 100
ip route replace default dev olctun table 100
```

Дополнительно нужно завести интерфейс в OpenWrt и в firewall (один раз):

```
uci batch <<'EOF'
set network.olctun=interface
set network.olctun.proto='none'
set network.olctun.device='olctun'
set network.olctun.auto='1'

add firewall zone
rename firewall.@zone[-1]='olc'
set firewall.olc.input='REJECT'
set firewall.olc.output='ACCEPT'
set firewall.olc.forward='REJECT'
set firewall.olc.masq='1'
set firewall.olc.mtu_fix='1'
add_list firewall.olc.network='olctun'

add firewall forwarding
set firewall.@forwarding[-1].src='lan'
set firewall.@forwarding[-1].dest='olc'

commit
EOF
/etc/init.d/network reload
/etc/init.d/firewall restart
```

## 2. DNS-leak prevention

Чтобы DNS-запросы Wi-Fi клиентов не утекали мимо туннеля:

- Либо отдать `dnsmasq` на роутере как единственный DNS (DHCP option 6),
  и его аплинк направить через `olctun` (обычно работает «само», т.к.
  весь LAN уже в таблице 100 и роутер сам ходит через `olctun`, если
  включена соответствующая `ip rule`).
- Либо поднять DoH/DoT (например, `https-dns-proxy`) на 127.0.0.1:5353
  и форварднуть из `dnsmasq` через него.

## 3. Selective routing по доменам (рекомендуется для производительности)

См. `docs/selective.md`. Идея: nftables set + `dnsmasq` `ipset`/`nftset`,
в таблицу 100 попадают только нужные домены.

## 4. Проверка

С Wi-Fi клиента:

```
curl https://ifconfig.me
curl https://api.ipify.org
```

IP-адрес должен совпадать с тем, что у olcRTC-сервера (или его SOCKS5
upstream), не с IP вашей квартиры.

На роутере:

```
logread -e olcrtc
ip route show table 100
ip rule
```

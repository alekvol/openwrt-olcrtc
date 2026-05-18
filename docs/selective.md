# Selective routing: гнать через olcrtc только нужные домены

Идея: на роутере живёт nftables set `olc_dst`, в неё `dnsmasq` сам
добавляет IP-адреса, которые он отрезолвил по списку доменов. Правило
`ip rule` отправляет в таблицу 100 (= в `olctun`) только пакеты с
dst в этом set'е.

## 1. nftables set

`/etc/nftables.d/30-olcrtc.nft`:

```
table inet olcrtc {
    set olc_dst4 {
        type ipv4_addr
        flags interval, timeout
        timeout 1h
    }
    set olc_dst6 {
        type ipv6_addr
        flags interval, timeout
        timeout 1h
    }

    chain mark {
        type route hook output priority -150;
        ip  daddr @olc_dst4 meta mark set 0x100
        ip6 daddr @olc_dst6 meta mark set 0x100
    }

    chain mark_fwd {
        type filter hook prerouting priority -150;
        ip  daddr @olc_dst4 meta mark set 0x100
        ip6 daddr @olc_dst6 meta mark set 0x100
    }
}
```

## 2. dnsmasq → set

`/etc/dnsmasq.conf` или `/etc/dnsmasq.d/olcrtc.conf`:

```
# домены, которые гоним через olcrtc
nftset=/youtube.com/4#inet#olcrtc#olc_dst4
nftset=/youtube.com/6#inet#olcrtc#olc_dst6
nftset=/instagram.com/4#inet#olcrtc#olc_dst4
nftset=/instagram.com/6#inet#olcrtc#olc_dst6
nftset=/facebook.com/4#inet#olcrtc#olc_dst4
nftset=/facebook.com/6#inet#olcrtc#olc_dst6
# ... и т.д.
```

Перезапустить:

```
service nftables-init restart 2>/dev/null || /etc/init.d/firewall restart
/etc/init.d/dnsmasq restart
```

## 3. ip rule по fwmark

```
uci add network rule
uci set network.@rule[-1].mark='0x100/0x100'
uci set network.@rule[-1].lookup='100'
uci commit network
/etc/init.d/network reload

ip route replace default dev olctun table 100
```

## 4. Проверка

```
nft list set inet olcrtc olc_dst4
ip rule
ip route show table 100
```

При резолве `youtube.com` IP появится в set, и пакеты на него
автоматически пойдут в `olctun` → SOCKS5 olcrtc → carrier.

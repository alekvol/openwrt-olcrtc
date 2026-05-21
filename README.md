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

## Настройка в веб-интерфейсе LuCI (для новичков)

После установки скриптом откройте веб-интерфейс роутера: **Службы → olcRTC** (или **Services → olcRTC**).

Вы можете настроить работу в одном из двух режимов в зависимости от ваших задач:

---

### Вариант 1: Настройка в режиме «Весь трафик через olcRTC» (встроенный туннель)

Этот вариант подходит, если вы хотите, чтобы все устройства, подключенные к роутеру (по Wi-Fi или проводу), автоматически выходили в интернет через olcRTC без дополнительных утилит.

1. **Вкладка Client (Клиент):**
   * Вставьте вашу ссылку подключения `olcrtc://...` в поле **Быстрое подключение** (Quick Import) и нажмите кнопку импорта. Все поля ниже заполнятся автоматически.
   * Убедитесь, что в поле **Включено** (Enabled) стоит галочка.
2. **Вкладка Tunnel (Туннель):**
   * Установите галочку **Включено** (Enabled) для запуска TUN-моста.
   * Прокрутите страницу вниз и нажмите синюю кнопку **«Настроить файрвол и маршрутизацию»** (или **Setup Firewall & Routing**). Подтвердите действие. 
   * Индикатор изменится на зеленый: `✓ Настроено` (Configured). Это создаст необходимые правила сети и файрвола автоматически.
3. Нажмите кнопку **Сохранить и применить** (Save & Apply) внизу страницы.
4. Перейдите на вкладку **Status** (Статус) и убедитесь, что оба сервиса (`olcRTC client` и `olcrtc-tun`) запущены (горят зеленые маркеры `Running`).

---

### Вариант 2: Использование как SOCKS5-прокси (для Podkop / Sing-box / PBR)

Этот вариант подходит, если у вас уже настроена утилита маршрутизации (например, **Podkop**, **vpn-policy-routing (pbr)** или **sing-box**) и вы хотите пускать через olcRTC только конкретные сайты/IP-адреса, а не весь трафик.

1. **Вкладка Client (Клиент):**
   * Импортируйте ссылку подключения `olcrtc://...` и убедитесь, что клиент включен.
   * Посмотрите параметры SOCKS5: по умолчанию роутер запустит прокси на адресе `127.0.0.1` и порт `8808`.
2. **Вкладка Tunnel (Туннель):**
   * ⚠️ **Туннель включать НЕ нужно!** Убедитесь, что галочка **Включено** (Enabled) снята, и автоматические правила файрвола удалены (или не настраивались).
3. Нажмите кнопку **Сохранить и применить** (Save & Apply).
4. Перейдите на вкладку **Status** (Статус): запущен должен быть только `olcRTC client` (зеленый маркер `Running`), а туннель должен быть `Stopped`.
5. **Настройка в Podkop / другой утилите:**
   * Откройте настройки вашей утилиты и добавьте новый прокси/outbound с протоколом **SOCKS5**.
   * Укажите хост: `127.0.0.1` и порт: `8808`.
   * Подробные инструкции: [Podkop](docs/integration-podkop.md) · [Sing-box](docs/integration-singbox.md)

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

# Интеграция olcRTC с sing-box

Руководство по использованию olcRTC в качестве SOCKS5-outbound
для [sing-box](https://sing-box.sagernet.org/) на OpenWrt.

## Предварительные требования

| Компонент | Что нужно |
|---|---|
| **olcRTC** | Установлен и запущен (зелёный маркер `Running` на вкладке Status). Туннель (`olcrtc-tun`) выключен. |
| **sing-box** | Установлен: `opkg install sing-box` (24.10) или `apk add sing-box` (25.12). |

> [!IMPORTANT]
> Не включайте `olcrtc-tun` при работе через sing-box.
> sing-box сам управляет маршрутизацией; включённый TUN от olcrtc
> приведёт к конфликту.

## Шаг 1 — Убедитесь, что olcRTC работает

```sh
# Прокси должен слушать на порту 8808
netstat -tlnp | grep 8808

# Проверка через curl
curl -x socks5h://127.0.0.1:8808 https://ifconfig.me
```

## Шаг 2 — Добавьте outbound в конфигурацию sing-box

### Вариант A: прямое редактирование JSON

Откройте конфигурацию sing-box (обычно `/etc/sing-box/config.json`) и
добавьте outbound:

```json
{
  "outbounds": [
    {
      "type": "socks",
      "tag": "olcrtc-proxy",
      "server": "127.0.0.1",
      "server_port": 8808
    },
    {
      "type": "direct",
      "tag": "direct"
    }
  ]
}
```

### Шаг 3 — Настройте маршрутизацию (route rules)

Добавьте правила маршрутизации, чтобы нужные домены шли через `olcrtc-proxy`:

```json
{
  "route": {
    "rules": [
      {
        "domain_suffix": [
          "youtube.com",
          "googlevideo.com",
          "ytimg.com",
          "ggpht.com"
        ],
        "outbound": "olcrtc-proxy"
      },
      {
        "domain_suffix": [
          "example-blocked-site.com"
        ],
        "outbound": "olcrtc-proxy"
      }
    ],
    "final": "direct"
  }
}
```

> [!TIP]
> `"final": "direct"` означает, что весь трафик, не попавший ни в одно
> правило, пойдёт напрямую. Если нужно пустить **весь** трафик через
> olcRTC, замените `"final"` на `"olcrtc-proxy"`.

### Полный минимальный пример конфигурации

```json
{
  "log": {
    "level": "info"
  },
  "inbounds": [
    {
      "type": "tun",
      "tag": "tun-in",
      "interface_name": "singbox-tun",
      "inet4_address": "172.19.0.1/30",
      "auto_route": true,
      "strict_route": true
    }
  ],
  "outbounds": [
    {
      "type": "socks",
      "tag": "olcrtc-proxy",
      "server": "127.0.0.1",
      "server_port": 8808
    },
    {
      "type": "direct",
      "tag": "direct"
    }
  ],
  "route": {
    "rules": [
      {
        "domain_suffix": [
          "youtube.com",
          "googlevideo.com"
        ],
        "outbound": "olcrtc-proxy"
      }
    ],
    "final": "direct"
  }
}
```

## Вариант Б: настройка через luci-app-homeproxy (UCI)

Если вы используете веб-интерфейс **homeproxy** для управления sing-box:

1. Откройте **LuCI → Службы → HomeProxy**.
2. Перейдите в раздел **Node** (Узлы) → **Add** (Добавить).
3. Заполните:

| Поле | Значение |
|---|---|
| Label | `olcrtc` |
| Type | **SOCKS** |
| Address | `127.0.0.1` |
| Port | `8808` |

4. Сохраните узел.
5. В разделе **Routing** (Маршрутизация) создайте правило,
   направляющее нужные домены через узел `olcrtc`.
6. **Сохранить и применить** (Save & Apply).

### Через командную строку UCI:

```sh
# Добавляем узел
uci add homeproxy node
uci set homeproxy.@node[-1].label='olcrtc'
uci set homeproxy.@node[-1].type='socks'
uci set homeproxy.@node[-1].address='127.0.0.1'
uci set homeproxy.@node[-1].port='8808'

uci commit homeproxy
/etc/init.d/homeproxy restart
```

> [!NOTE]
> Названия секций и опций могут отличаться в зависимости от версии
> homeproxy. Используйте `uci show homeproxy` для проверки.

## Проверка работы

1. **Перезапустите sing-box:**

   ```sh
   /etc/init.d/sing-box restart
   ```

2. **Проверьте, что sing-box поднял outbound:**

   ```sh
   logread -e sing-box | grep olcrtc
   ```

3. **На клиенте** — откройте домен из правил маршрутизации и убедитесь,
   что трафик идёт через olcRTC:

   ```sh
   # С самого роутера (если sing-box в режиме TUN)
   curl https://youtube.com -I
   ```

4. **Сверка IP** — внешний IP при обращении к домену из правил должен
   отличаться от вашего обычного IP.

## Устранение неполадок

| Проблема | Решение |
|---|---|
| sing-box не стартует | Проверьте JSON-конфигурацию: `sing-box check -c /etc/sing-box/config.json`. Ошибки синтаксиса — самая частая причина. |
| Outbound `olcrtc-proxy` не работает | Убедитесь, что olcRTC запущен и порт `8808` слушается: `netstat -tlnp \| grep 8808`. |
| Трафик не идёт через olcRTC | Проверьте правила маршрутизации: домен должен быть в `domain_suffix` с outbound `olcrtc-proxy`. |
| Конфликт с olcrtc-tun | Отключите туннель: `uci set olcrtc-tun.main.enabled=0 && uci commit olcrtc-tun && /etc/init.d/olcrtc-tun stop`. |
| Медленная работа | Проверьте загрузку CPU. DTLS/SRTP + sing-box TUN = двойная нагрузка на слабых устройствах. |

## См. также

- [README — Вариант 2: SOCKS5-прокси](../README.md)
- [Интеграция с Podkop](integration-podkop.md)

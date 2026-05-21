# Интеграция olcRTC с Podkop

Руководство по настройке olcRTC в качестве SOCKS5-прокси для
[Podkop](https://github.com/itdoginfo/podkop) на OpenWrt.

## Предварительные требования

| Компонент | Что нужно |
|---|---|
| **olcRTC** | Установлен и запущен (зелёный маркер `Running` на вкладке Status). Туннель (`olcrtc-tun`) выключен. |
| **Podkop** | Установлен через `opkg install podkop luci-app-podkop` (24.10) или `apk add podkop luci-app-podkop` (25.12). |

> [!IMPORTANT]
> Не включайте `olcrtc-tun` (вкладка Tunnel) при работе через Podkop.
> Podkop сам управляет маршрутизацией трафика, и включённый TUN-интерфейс
> приведёт к конфликту маршрутов.

## Шаг 1 — Убедитесь, что olcRTC работает

Откройте **LuCI → Службы → olcRTC → Status** и проверьте:

- `olcRTC client` — **Running** (зелёный)
- `olcrtc-tun` — **Stopped** (серый)

Из консоли:

```sh
# Проверка, что SOCKS5-прокси отвечает
curl -x socks5h://127.0.0.1:8808 https://ifconfig.me
```

Если в ответ пришёл IP — прокси работает.

## Шаг 2 — Настройка в LuCI (Podkop)

1. Откройте **LuCI → Службы → Podkop** (Services → Podkop).
2. В разделе **Proxy / Outbound** нажмите **Add** (Добавить).
3. Заполните поля:

| Поле | Значение |
|---|---|
| Имя (Name) | `olcrtc` (произвольное) |
| Тип (Type) | **SOCKS5** |
| Хост (Server) | `127.0.0.1` |
| Порт (Port) | `8808` |

4. Сохраните прокси.
5. Перейдите в раздел **Правила / Rules** и создайте правило:
   - **Список доменов / Domain list** — укажите домены, которые должны
     идти через olcRTC (например, `youtube.com`, `googlevideo.com`).
   - **Outbound** — выберите только что созданный `olcrtc`.
6. Нажмите **Сохранить и применить** (Save & Apply).

## Альтернатива: настройка через UCI (командная строка)

```sh
# Добавляем прокси
uci add podkop proxy
uci set podkop.@proxy[-1].name='olcrtc'
uci set podkop.@proxy[-1].type='socks5'
uci set podkop.@proxy[-1].server='127.0.0.1'
uci set podkop.@proxy[-1].port='8808'

# Добавляем правило (пример: YouTube)
uci add podkop rule
uci set podkop.@rule[-1].name='youtube-via-olcrtc'
uci set podkop.@rule[-1].outbound='olcrtc'
uci add_list podkop.@rule[-1].domain='youtube.com'
uci add_list podkop.@rule[-1].domain='googlevideo.com'
uci add_list podkop.@rule[-1].domain='ytimg.com'
uci add_list podkop.@rule[-1].domain='ggpht.com'

uci commit podkop
/etc/init.d/podkop restart
```

> [!NOTE]
> Имена секций и опций могут отличаться в зависимости от версии Podkop.
> Проверьте актуальные опции командой `uci show podkop`.

## Проверка работы

1. **На роутере** — убедитесь, что прокси отвечает:

   ```sh
   curl -x socks5h://127.0.0.1:8808 https://ifconfig.me
   ```

2. **На клиенте** — откройте в браузере домен из списка правил
   (например, `youtube.com`). Трафик должен пойти через olcRTC.

3. **Проверка логов:**

   ```sh
   logread -e podkop
   logread -e olcrtc
   ```

## Устранение неполадок

| Проблема | Решение |
|---|---|
| Podkop не видит прокси | Убедитесь, что olcRTC запущен: `pgrep olcrtc`. Проверьте, что порт `8808` слушается: `netstat -tlnp \| grep 8808`. |
| Трафик идёт мимо прокси | Проверьте, что домен добавлен в правило Podkop и выбран правильный outbound. Перезапустите Podkop: `/etc/init.d/podkop restart`. |
| Конфликт с olcrtc-tun | Отключите туннель: `uci set olcrtc-tun.main.enabled=0 && uci commit olcrtc-tun && /etc/init.d/olcrtc-tun stop`. |
| Сайт открывается, но медленно | Проверьте загрузку CPU (`top`). olcRTC использует DTLS/SRTP — на слабых роутерах возможна нагрузка. |
| `curl` через прокси зависает | Убедитесь, что watchdog не перезагружает olcRTC: `logread -e olcrtc-watchdog`. Проверьте связь с carrier-сервером. |

## См. также

- [README — Вариант 2: SOCKS5-прокси](../README.md)
- [Интеграция с Sing-box](integration-singbox.md)

#!/bin/sh
# olcrtc watchdog: пинговать probe URL через локальный SOCKS5 и
# перезапускать сервис olcrtc, если он недоступен.
#
# Параметры передаются как аргументы (см. olcrtc.init).

set -u

SOCKS_HOST="${1:-127.0.0.1}"
SOCKS_PORT="${2:-8808}"
SOCKS_USER="${3:-}"
SOCKS_PASS="${4:-}"
PROBE_URL="${5:-https://www.google.com/generate_204}"
INTERVAL="${6:-30}"
TIMEOUT="${7:-10}"
MAX_FAILS="${8:-3}"

fails=0

log() { logger -t olcrtc-watchdog "$*"; }

build_proxy() {
	if [ -n "$SOCKS_USER" ]; then
		echo "socks5h://$SOCKS_USER:$SOCKS_PASS@$SOCKS_HOST:$SOCKS_PORT"
	else
		echo "socks5h://$SOCKS_HOST:$SOCKS_PORT"
	fi
}

PROXY=$(build_proxy)

log "starting: probe=$PROBE_URL via $SOCKS_HOST:$SOCKS_PORT interval=${INTERVAL}s timeout=${TIMEOUT}s max_fails=$MAX_FAILS"

# дать сервису время прогреться
sleep 15

while :; do
	if curl --proxy "$PROXY" \
	        --max-time "$TIMEOUT" \
	        --silent --show-error \
	        --output /dev/null \
	        --write-out '%{http_code}' \
	        "$PROBE_URL" 2>/dev/null | grep -qE '^(2|3)[0-9]{2}$'; then
		if [ "$fails" -gt 0 ]; then
			log "probe OK, resetting fail counter (was $fails)"
		fi
		fails=0
	else
		fails=$((fails + 1))
		log "probe FAILED ($fails/$MAX_FAILS)"
		if [ "$fails" -ge "$MAX_FAILS" ]; then
			log "restarting olcrtc service"
			/etc/init.d/olcrtc restart
			fails=0
			# не молотить рестартами — дать сервису перезайти
			sleep 30
		fi
	fi
	sleep "$INTERVAL"
done

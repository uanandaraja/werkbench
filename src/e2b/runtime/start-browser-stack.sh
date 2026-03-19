#!/usr/bin/env bash
set -euo pipefail

USER_NAME="user"
USER_HOME="/home/user"
DISPLAY_NAME="${DEVBOX_BROWSER_DISPLAY:-:1}"
SCREEN_GEOMETRY="${DEVBOX_BROWSER_RESOLUTION:-1440x900x24}"
NOVNC_PORT="${E2B_BROWSER_PORT:-6080}"
VNC_PORT="${DEVBOX_BROWSER_VNC_PORT:-5901}"
START_URL="${DEVBOX_BROWSER_START_URL:-about:blank}"
NOVNC_DIR="/opt/novnc"
PROFILE_DIR="${USER_HOME}/.cache/devbox/browser-profile"
LOG_DIR="/var/log/e2b"
SCREEN_SIZE="${SCREEN_GEOMETRY%x*}"
SCREEN_WIDTH="${SCREEN_SIZE%x*}"
SCREEN_HEIGHT="${SCREEN_SIZE#*x}"

mkdir -p "${LOG_DIR}" "${PROFILE_DIR}"
chown -R "${USER_NAME}:${USER_NAME}" "${USER_HOME}/.cache/devbox"
rm -f /tmp/e2b-browser-ready

run_user_background() {
  local logfile="$1"
  shift

  nohup sudo -u "${USER_NAME}" env \
    HOME="${USER_HOME}" \
    USER="${USER_NAME}" \
    LOGNAME="${USER_NAME}" \
    DISPLAY="${DISPLAY_NAME}" \
    XAUTHORITY="${USER_HOME}/.Xauthority" \
    "$@" >"${logfile}" 2>&1 &
}

if ! pgrep -u "${USER_NAME}" -f "Xvfb ${DISPLAY_NAME}" >/dev/null 2>&1; then
  run_user_background "${LOG_DIR}/xvfb.log" \
    Xvfb "${DISPLAY_NAME}" -screen 0 "${SCREEN_GEOMETRY}" -ac +extension RANDR
fi

sleep 1

if ! pgrep -u "${USER_NAME}" -f "openbox" >/dev/null 2>&1; then
  run_user_background "${LOG_DIR}/openbox.log" openbox
fi

if ! pgrep -u "${USER_NAME}" -f "x11vnc.*${VNC_PORT}" >/dev/null 2>&1; then
  run_user_background "${LOG_DIR}/x11vnc.log" \
    x11vnc \
    -display "${DISPLAY_NAME}" \
    -rfbport "${VNC_PORT}" \
    -forever \
    -shared \
    -nopw \
    -xkb
fi

if ! pgrep -f "websockify .*${NOVNC_PORT}" >/dev/null 2>&1; then
  nohup /usr/local/bin/websockify \
    --web "${NOVNC_DIR}" \
    "${NOVNC_PORT}" \
    "127.0.0.1:${VNC_PORT}" >"${LOG_DIR}/novnc.log" 2>&1 &
fi

if ! pgrep -u "${USER_NAME}" -f "google-chrome-stable.*${PROFILE_DIR}" >/dev/null 2>&1; then
  run_user_background "${LOG_DIR}/chrome.log" \
    /usr/bin/google-chrome-stable \
    --user-data-dir="${PROFILE_DIR}" \
    --no-first-run \
    --no-default-browser-check \
    --disable-dev-shm-usage \
    --disable-gpu \
    --window-position=0,0 \
    --window-size="${SCREEN_WIDTH},${SCREEN_HEIGHT}" \
    --start-maximized \
    --new-window \
    "${START_URL}"
fi

for _ in $(seq 1 30); do
  if ss -tuln | grep -q ":${NOVNC_PORT}\\b"; then
    touch /tmp/e2b-browser-ready
    exit 0
  fi

  sleep 1
done

tail -n 50 "${LOG_DIR}/xvfb.log" >&2 || true
tail -n 50 "${LOG_DIR}/openbox.log" >&2 || true
tail -n 50 "${LOG_DIR}/x11vnc.log" >&2 || true
tail -n 50 "${LOG_DIR}/novnc.log" >&2 || true
tail -n 50 "${LOG_DIR}/chrome.log" >&2 || true
exit 1

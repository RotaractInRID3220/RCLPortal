#!/bin/bash
# Opens a private tunnel from this machine to the production Postgres on sandinu-vps (Dokploy).
#   scripts/vps-tunnel.sh        -> 127.0.0.1:55432 (leave running; Ctrl+C closes it and removes the helper)
# The database has no public port; a loopback-only socat container on the VPS is started for the session.
set -euo pipefail
HOST=${VPS_HOST:-sandinu-vps}; PORT=${VPS_DB_LOCAL_PORT:-55432}
DBHOST=$(ssh -o BatchMode=yes "$HOST" 'docker ps --format "{{.Names}}" | grep -m1 "^rcl-db-"' | sed 's/\..*//')
[ -n "$DBHOST" ] || { echo "rcl-db service not found on $HOST" >&2; exit 1; }
cleanup() { ssh "$HOST" 'docker rm -f rcl-tunnel >/dev/null 2>&1' || true; echo "tunnel closed"; }
trap cleanup EXIT INT TERM
ssh "$HOST" "docker rm -f rcl-tunnel >/dev/null 2>&1; docker run -d --rm --name rcl-tunnel --network dokploy-network -p 127.0.0.1:55432:5432 alpine/socat tcp-listen:5432,fork,reuseaddr tcp:$DBHOST:5432 >/dev/null"
echo "tunnel up: postgres://127.0.0.1:$PORT -> $DBHOST (Ctrl+C to close)"
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L "$PORT:127.0.0.1:55432" "$HOST"

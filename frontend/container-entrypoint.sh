#!/usr/bin/env bash
set -euo pipefail
/opt/app-root/bin/render-runtime-config.sh
exec nginx -g 'daemon off;'

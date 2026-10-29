#!/usr/bin/env bash
# Grava o passeio pelo novo layout 1.2.0 num simulador iOS.
#   e2e/flows/novo-layout-ios.sh
# Precisa de um build feito com EXPO_PUBLIC_MAUTIC_E2E_DEMO=1 ja instalado no simulador:
# sem essa flag o app so abre os mocks pelo gesto de balancar, que o simulador nao injeta.
# Env: UDID (simulador), OUT_DIR (saida), MAESTRO (binario do Maestro).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
udid="${UDID:-$(xcrun simctl list devices booted -j | python3 -c 'import json,sys;d=json.load(sys.stdin)["devices"];print(next(x["udid"] for v in d.values() for x in v if x["state"]=="Booted"))')}"
out="${OUT_DIR:-$root/artifacts/qa/novo-layout}"
maestro="${MAESTRO:-$HOME/.maestro/bin/maestro}"
mkdir -p "$out"
video="$out/novo-layout-1.2.0.mp4"
rm -f "$video"

printf 'Simulador: %s\nVideo: %s\n' "$udid" "$video"
xcrun simctl terminate "$udid" com.distributionmachine.mauticinbox.demo 2>/dev/null || true

xcrun simctl io "$udid" recordVideo --codec h264 --force "$video" &
recorder=$!
# A gravacao leva um instante para abrir o arquivo.
sleep 2

status=0
"$maestro" --udid "$udid" test "$here/novo-layout.yaml" \
  --format junit --output "$out/novo-layout.xml" --test-output-dir "$out/maestro" || status=$?

# SIGINT fecha o container mp4; matar com TERM deixaria o arquivo truncado.
kill -INT "$recorder" 2>/dev/null || true
wait "$recorder" 2>/dev/null || true
sleep 1

if [ -s "$video" ]; then printf 'Gravado: %s (%s)\n' "$video" "$(du -h "$video" | cut -f1)"; else printf 'SEM VIDEO\n'; status=1; fi
find "$out/maestro" -name '[0-9][0-9]-*.png' -exec cp {} "$out/" \; 2>/dev/null || true
exit $status

#!/usr/bin/env bash
# Grava um flow do Maestro num simulador iOS.
#   e2e/flows/novo-layout-ios.sh                      # o passeio pelo novo layout
#   FLOW=e2e/flows/api-real.yaml e2e/flows/novo-layout-ios.sh
# O flow de mocks precisa de um build com EXPO_PUBLIC_MAUTIC_E2E_DEMO=1; os de API real
# precisam de um build SEM essa flag e de uma sessao ja iniciada no simulador.
# Env: FLOW (flow a rodar), UDID (simulador), OUT_DIR (saida), MAESTRO (binario do Maestro).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
flow="${FLOW:-$here/novo-layout.yaml}"
[ -f "$flow" ] || { printf 'Flow nao encontrado: %s\n' "$flow" >&2; exit 2; }
flow="$(cd "$(dirname "$flow")" && pwd)/$(basename "$flow")"
name="$(basename "${flow%.yaml}")"
version="$(node -p 'require("'"$root"'/package.json").version')"
udid="${UDID:-$(xcrun simctl list devices booted -j | python3 -c 'import json,sys;d=json.load(sys.stdin)["devices"];print(next(x["udid"] for v in d.values() for x in v if x["state"]=="Booted"))')}"
out="${OUT_DIR:-$root/artifacts/qa/$name}"
maestro="${MAESTRO:-$HOME/.maestro/bin/maestro}"
mkdir -p "$out"
video="$out/$name-$version.mp4"

# Limpa tudo o que a corrida anterior deixou: um PNG velho ja me fez diagnosticar o
# problema errado, porque so o video e o diretorio do Maestro eram apagados.
rm -rf "$out"
mkdir -p "$out"

printf 'Flow:       %s\nSimulador:  %s\nVideo:      %s\n' "$name" "$udid" "$video"
xcrun simctl terminate "$udid" com.distributionmachine.mauticinbox.demo 2>/dev/null || true

xcrun simctl io "$udid" recordVideo --codec h264 --force "$video" &
recorder=$!
# A gravacao leva um instante para abrir o arquivo.
sleep 2

rc=0
"$maestro" --udid "$udid" test "$flow" \
  --format junit --output "$out/$name.xml" --test-output-dir "$out/maestro" || rc=$?

# SIGINT fecha o container mp4; matar com TERM deixaria o arquivo truncado.
kill -INT "$recorder" 2>/dev/null || true
wait "$recorder" 2>/dev/null || true
sleep 1

if [ -s "$video" ]; then printf 'Gravado: %s (%s)\n' "$video" "$(du -h "$video" | cut -f1)"; else printf 'SEM VIDEO\n'; rc=1; fi
find "$out/maestro" -name '[0-9][0-9]*-*.png' -exec cp {} "$out/" \; 2>/dev/null || true
printf 'Maestro saiu com %s\n' "$rc"
exit $rc

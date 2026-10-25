#!/usr/bin/env bash
# Opens "Modo de teste" on the Connections screen of an Android emulator: three alternating
# accelerometer impulses (the app's ShakeDetector), injected through the emulator console.
# No hidden shortcut exists in the app; this only works on an emulator.
set -euo pipefail
adb_cmd=(adb); [ -n "${ANDROID_SERIAL:-}" ] && adb_cmd+=(-s "$ANDROID_SERIAL")
rest=0:9.81:0
for round in 1 2; do
 for x in 18 -18 18 -18; do "${adb_cmd[@]}" emu sensor set acceleration "$x:9.81:0" >/dev/null; sleep 0.25; done
 "${adb_cmd[@]}" emu sensor set acceleration "$rest" >/dev/null
 sleep 2.5
done

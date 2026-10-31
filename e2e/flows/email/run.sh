#!/usr/bin/env bash
# E-mail channel e2e (app 1.1.0) on an Android emulator with the release APK already installed.
#   e2e/flows/email/run.sh
# Env: ANDROID_SERIAL (default emulator-5554), MAESTRO (default maestro), DEMO_DIR (screenshots),
#      OUT_DIR (JUnit reports and Maestro output), RECORD=1 records flows 02-04 to $DEMO_DIR/email-thread-demo.mp4.
# The flows share one app session: test mode is not remembered across restarts, so they run in order.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
export DEMO_DIR="${DEMO_DIR:-$(cd "$here/../../.." && pwd)/artifacts/demo}"
maestro="${MAESTRO:-maestro}";out="${OUT_DIR:-$DEMO_DIR/maestro}"
mkdir -p "$DEMO_DIR" "$out"
results=()
# Maestro keeps takeScreenshot files inside the run's output folder; the named ones (NN-*.png) are copied to DEMO_DIR.
run(){ local flow=$1 name=${1%.yaml} code=0;echo "== $flow"
 "$maestro" --device "$ANDROID_SERIAL" test "$here/$flow" --format junit --output "$out/$name.xml" --test-output-dir "$out/$name"||code=$?
 find "$out/$name" -name '[0-9][0-9]-*.png' -exec cp {} "$DEMO_DIR/" \; 2>/dev/null||true
 if [ $code = 0 ];then results+=("PASS $flow");else results+=("FAIL $flow");return 1;fi; }
summary(){ printf '%s\n' "${results[@]}";}
trap summary EXIT
run 00-fresh-connections.yaml
bash "$here/shake.sh"
run 01-enter-demo.yaml
rec=""
if [ "${RECORD:-0}" = 1 ];then adb shell rm -f /sdcard/email-demo.mp4;adb shell screenrecord --bit-rate 6000000 --time-limit 180 /sdcard/email-demo.mp4 & rec=$!;sleep 1;fi
status=0
for flow in 02-email-thread.yaml 03-expand-collapse-quoted.yaml 04-reply-with-subject.yaml;do run "$flow"||{ status=1;break;};done
if [ -n "$rec" ];then adb shell pkill -INT screenrecord||true;wait "$rec"||true;sleep 2;adb pull /sdcard/email-demo.mp4 "$DEMO_DIR/email-thread-demo.mp4";fi
if [ $status = 0 ];then run 05-start-from-sheet.yaml||status=1;fi
exit $status

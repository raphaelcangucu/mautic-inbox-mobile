#!/usr/bin/env bash
# Live e-mail e2e: the app (e2e build) against a local Mautic bench, through the real server.
#
# Order of a full run:
#   1. mautic-multi-mail-bundle Tests/e2e/run.sh with E2E_SUMMARY=<file>: builds a real thread
#      (outgoing e-mails, the lead's reply over IMAP, survey events) and writes the summary;
#   2. this script: installs the e2e APK, trusts the bench CA as a user CA (adb root, emulator only),
#      forwards :8443, logs in with the magic code read from GreenMail, opens the thread, replies,
#      and checks that the lead's mailbox got the reply threaded with In-Reply-To.
#
# Env: SUMMARY (required), MULTIMAIL_DIR, APK, CA_CERT, ANDROID_SERIAL (default emulator-5554),
#      MAESTRO (default maestro), OUT_DIR, DEMO_DIR, RECORD=1 (records flow 12 to $DEMO_DIR/email-live-e2e.mp4).
# The e2e APK comes from a prebuild with MAUTIC_E2E_USER_CA=1; store builds never trust user CAs.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
: "${SUMMARY:?set SUMMARY to the server e2e summary file}"
multimail="${MULTIMAIL_DIR:-$HOME/mautic-multi-mail-bundle}"
export ANDROID_SERIAL="${ANDROID_SERIAL:-emulator-5554}"
maestro="${MAESTRO:-maestro}"
demo="${DEMO_DIR:-$repo/artifacts/demo}"; out="${OUT_DIR:-$demo/maestro-live}"
mkdir -p "$demo" "$out"
field(){ node -p "require(process.argv[1])[process.argv[2]]" "$SUMMARY" "$1"; }
url="$(field base_url)"; operator="$(field operator)"; conversation="$(field conversation_id)"; subject="$(field subject)"
lead="$(field lead)"; lead_message="$(field lead_message_id)"; run_id="$(field run)"
# Maestro matches text as a regular expression: escape the subject.
subject_re="$(node -p "process.argv[1].replace(/[.*+?^\${}()|[\]\\\\]/g,'\\\\$&')" "$subject")"
reply="Resposta pelo app $run_id com Pix e deposito minimo de cem reais"

if [ -n "${APK:-}" ]; then adb install -r "$APK" >/dev/null; fi
if [ -n "${CA_CERT:-}" ]; then
  hash="$(openssl x509 -inform PEM -subject_hash_old -in "$CA_CERT" -noout)"
  tmp="$(mktemp -d)"; cp "$CA_CERT" "$tmp/$hash.0"
  adb root >/dev/null; sleep 2; adb wait-for-device
  adb shell mkdir -p /data/misc/user/0/cacerts-added
  adb push "$tmp/$hash.0" "/data/misc/user/0/cacerts-added/$hash.0" >/dev/null
  adb shell chmod 644 "/data/misc/user/0/cacerts-added/$hash.0"
  rm -rf "$tmp"
fi
adb reverse tcp:8443 tcp:8443 >/dev/null

results=()
step(){ local flow=$1 code=0; shift; echo "== $flow"
  rm -rf "${out:?}/${flow%.yaml}"   # Maestro keeps old runs here; the screenshot copy must see only this one
  "$maestro" --device "$ANDROID_SERIAL" test "$here/$flow" "$@" --format junit --output "$out/${flow%.yaml}.xml" --test-output-dir "$out/${flow%.yaml}" || code=$?
  find "$out/${flow%.yaml}" -name '[0-9][0-9]-*.png' -exec cp {} "$demo/" \; 2>/dev/null || true
  if [ $code = 0 ]; then results+=("PASS $flow"); else results+=("FAIL $flow"); exit 1; fi; }
trap 'printf "%s\n" "${results[@]}"' EXIT

# The server e2e asked for this operator's code moments ago; the server allows one a minute.
sleep 61
step 10-login-request.yaml -e "MAUTIC_URL=$url" -e "OPERATOR=$operator"
code="$(php "$multimail/Tests/e2e/mailbox.php" code "$operator")"
step 11-login-verify.yaml -e "CODE=$code" -e "CONVERSATION_ID=$conversation" -e "SUBJECT=$subject_re"
rec=""
if [ "${RECORD:-0}" = 1 ]; then adb shell rm -f /sdcard/email-live.mp4; adb shell screenrecord --bit-rate 6000000 --time-limit 170 /sdcard/email-live.mp4 & rec=$!; sleep 1; fi
step 12-thread-and-reply.yaml -e "CONVERSATION_ID=$conversation" -e "SUBJECT=$subject_re" -e "REPLY=$reply"
if [ -n "$rec" ]; then sleep 3; adb shell pkill -INT screenrecord || true; wait "$rec" || true; sleep 2; adb pull /sdcard/email-live.mp4 "$demo/email-live-e2e.mp4" >/dev/null; fi

echo "== lead mailbox"
arrived="$(php "$multimail/Tests/e2e/mailbox.php" expect "$lead" "$reply" 60)"
echo "$arrived"
node -e '
const [json, lead, subject] = process.argv.slice(1); const mail = JSON.parse(json);
if (!String(mail.in_reply_to || "").includes(lead)) { console.error("In-Reply-To does not point at the lead reply"); process.exit(1); }
if (mail.subject !== subject) { console.error("subject changed: " + mail.subject); process.exit(1); }' "$arrived" "$lead_message" "$subject"
results+=("PASS app reply reached the lead threaded on the lead's message")

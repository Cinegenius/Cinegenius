#!/usr/bin/env bash
set -euo pipefail
umask 077
export PATH=/home/cinegenius/.local/bin:/usr/local/bin:/usr/bin:/bin
runtime_root=/srv/cinegenius/news-agent/runtime
mkdir -p "$runtime_root"/{state,runs,drafts,tmp,cache,codex-state}
exec 9>"$runtime_root/state/run.lock"
if ! /usr/bin/flock -n 9; then
  echo '{"mode":"research_only","status":"skipped_overlap"}'
  exit 0
fi
started=$SECONDS
if [[ " $* " == *" --smoke "* ]]; then
  /usr/bin/python3 "$runtime_root/bin/research.py" "$@"
  exit 0
fi
if [[ -f "$runtime_root/feedback/enabled" ]]; then
  /usr/bin/timeout --kill-after=5 40s /usr/bin/python3 "$runtime_root/bin/feedback.py" || feedback_status=$?
  if [[ ${feedback_status:-0} -ne 0 ]]; then
    echo '{"mode":"editorial_readership","status":"unavailable_balanced_selection_retained"}'
  fi
fi
# Use the same overlap lock and the publisher's own mutation lock. The expiry
# journal survives an interrupted response; hidden entries are never restored.
if [[ -f "$runtime_root/expiry/enabled" ]]; then
  /usr/bin/timeout --kill-after=5 125s /usr/bin/python3 "$runtime_root/bin/expiry.py" || expiry_status=$?
  if [[ ${expiry_status:-0} -ne 0 ]]; then
    echo '{"mode":"editorial_expiry","status":"interrupted_or_failed_check_private_receipt"}'
  fi
fi
# Reserve room for maintenance and publication inside the existing 600s service.
# A caller's smaller research timeout remains respected.
research_budget=260
previous_arg=''
for current_arg in "$@"; do
  if [[ "$previous_arg" == '--timeout' && "$current_arg" =~ ^[0-9]+$ ]] && ((10#$current_arg < research_budget)); then
    research_budget=$((10#$current_arg))
  fi
  previous_arg=$current_arg
done
/usr/bin/timeout --kill-after=5 315s /usr/bin/python3 "$runtime_root/bin/research.py" "$@" --timeout "$research_budget"
# Existing system service has a 600s wall limit. Leave 30s for shutdown; the
# publisher's stable IDs recover a timeout after any acknowledged/unacknowledged save.
remaining=$((570 - (SECONDS - started)))
if [[ -f "$runtime_root/publisher/enabled" && $remaining -ge 60 && " $* " != *" --smoke "* ]]; then
  /usr/bin/timeout --kill-after=5 "${remaining}s" /usr/bin/python3 "$runtime_root/bin/publisher.py" || status=$?
  if [[ ${status:-0} -ne 0 ]]; then
    echo '{"mode":"editorial_publication","status":"interrupted_or_failed_check_private_receipt"}'
  fi
fi

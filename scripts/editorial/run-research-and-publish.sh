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
/usr/bin/python3 "$runtime_root/bin/research.py" "$@"
# Existing system service has a 600s wall limit. Leave 30s for shutdown; the
# publisher's stable IDs recover a timeout after any acknowledged/unacknowledged save.
remaining=$((570 - (SECONDS - started)))
if [[ -f "$runtime_root/publisher/enabled" && $remaining -ge 60 && " $* " != *" --smoke "* ]]; then
  /usr/bin/timeout --kill-after=5 "${remaining}s" /usr/bin/python3 "$runtime_root/bin/publisher.py" || status=$?
  if [[ ${status:-0} -ne 0 ]]; then
    echo '{"mode":"editorial_publication","status":"interrupted_or_failed_check_private_receipt"}'
  fi
fi

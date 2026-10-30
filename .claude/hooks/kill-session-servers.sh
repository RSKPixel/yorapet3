#!/bin/sh
# SessionEnd hook: stop servers (any process listening on a TCP port) that this
# Claude window started. Processes started by Claude inherit
# CLAUDE_CODE_SESSION_ID and CLAUDE_PID; matching both leaves alone servers
# from your own terminals and from other windows open on the same session.
sid=$(jq -r '.session_id // empty')
[ -n "$sid" ] || sid=$CLAUDE_CODE_SESSION_ID
[ -n "$sid" ] || exit 0

# The Claude process this hook belongs to: CLAUDE_PID, or else the nearest
# ancestor process named claude.
owner=$CLAUDE_PID
if [ -z "$owner" ]; then
    p=$PPID
    while [ -n "$p" ] && [ "$p" -gt 1 ]; do
        case "$(ps -o comm= -p "$p" 2>/dev/null)" in
            *claude*) owner=$p; break ;;
        esac
        p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
    done
fi
[ -n "$owner" ] || exit 0

pids=""
for pid in $(lsof -nP -tiTCP -sTCP:LISTEN 2>/dev/null | sort -u); do
    [ "$pid" = "$owner" ] && continue
    env=$(ps eww -o command= -p "$pid" 2>/dev/null | tr ' ' '\n')
    if printf '%s\n' "$env" | grep -qx "CLAUDE_CODE_SESSION_ID=$sid" &&
        printf '%s\n' "$env" | grep -qx "CLAUDE_PID=$owner"; then
        pids="$pids $pid"
    fi
done
[ -n "$pids" ] || exit 0

kill $pids 2>/dev/null
sleep 2
kill -9 $pids 2>/dev/null
echo "Stopped session servers:$pids" >&2
exit 0

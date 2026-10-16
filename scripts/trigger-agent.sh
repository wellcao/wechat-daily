#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="/root/wechat-daily"
DATE_VALUE="${1:-$(TZ=Asia/Shanghai date +%F)}"
PROMPT_FILE="$ROOT_DIR/智能体任务说明.md"
TASK_FILE="$(mktemp)"
trap 'rm -f "$TASK_FILE"' EXIT

cat "$PROMPT_FILE" > "$TASK_FILE"
cat >> "$TASK_FILE" <<EOF

本次执行日期：$DATE_VALUE

请现在开始执行完整流程。先检查仓库当前状态和已有草稿，避免覆盖用户未要求删除的内容。完成后用简短结果说明：检索来源、文章路径、草稿 Media ID、提醒发送状态和任何阻塞原因。
EOF

cd "$ROOT_DIR"
/usr/local/bin/openclaw agent \
  --agent main \
  --session-key agent:main:wechat-daily \
  --message-file "$TASK_FILE" \
  --thinking high \
  --timeout 1200 \
  --json

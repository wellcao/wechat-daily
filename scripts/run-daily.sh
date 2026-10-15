#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="/root/wechat-daily"
LOG_DIR="$ROOT_DIR/logs"
TOOLS_DIR="$ROOT_DIR/tools"
DATE_VALUE="$(TZ=Asia/Shanghai date +%F)"
mkdir -p "$LOG_DIR"
exec >>"$LOG_DIR/$DATE_VALUE.log" 2>&1

cd "$ROOT_DIR"
if [ ! -s .env ]; then
  echo "Missing .env"
  exit 1
fi

node scripts/generate-daily.js "$DATE_VALUE"
ARTICLE_TITLE="$(sed -n 's/^title: //p' "$DATE_VALUE/发布.md")"
THEME_LIST=(default orangeheart rainbow lapis pie maize purple phycat)
THEME_INDEX=$((10#$(date -d "$DATE_VALUE" +%s) / 86400 % 8))
THEME="${THEME_LIST[$THEME_INDEX]}"

"$TOOLS_DIR/node_modules/.bin/wenyan" publish -f "$DATE_VALUE/发布.md" --env-file .env -t "$THEME"

if /usr/local/bin/openclaw message send \
  --channel openclaw-weixin \
  --target 'o9cq807dwBujajyUpl67pLJ1yqJM@im.wechat' \
  --message "公众号草稿已创建：$ARTICLE_TITLE。请打开公众号后台检查并手动发表。" \
  --json; then
  echo "Clawbot notification sent"
else
  echo "WARNING: draft succeeded but Clawbot notification failed"
fi

git add "$DATE_VALUE"
if ! git diff --cached --quiet; then
  git -c user.name='wechat-daily-bot' -c user.email='wechat-daily@localhost' commit -m "Add daily digest $DATE_VALUE"
  GIT_SSH_COMMAND='ssh -i /root/.ssh/wechat-daily-deploy -o IdentitiesOnly=yes' git push origin HEAD
fi

echo "Published draft for $DATE_VALUE with theme $THEME"

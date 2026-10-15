# wechat-daily

服务器上的每日资讯草稿任务：北京时间工作日 08:00 核对交易时段和 Nasdaq 财报日历，生成出稿后至次日 08:00 的未来日程预告、带来源链接的 Markdown 和配图，再使用 WenYan 上传到微信公众号草稿箱。缺少可核对时间的事件就不写，周末不把已发生新闻补进稿件。

## 手动运行

```bash
cd /root/wechat-daily/tools && npm install
/root/wechat-daily/scripts/run-daily.sh
```

任务只调用草稿接口，不调用正式发表接口。`.env` 只保存在服务器，不提交 Git。

稿件内容和格式以 `公众号稿件要求.md` 为准：写下一个工作日将要发生的事，不写昨夜收盘回顾。每篇草稿打开留言，并允许任何人留言。`only_fans_can_comment` 用数字 0，不要写成字符串。

每次改完并提交后，都要推到这个仓库的 `main`。不要强制推送。`.env` 和带有 AppSecret 的迁移说明不要提交。

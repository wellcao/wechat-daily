# wechat-daily

服务器上的每日资讯草稿任务：北京时间工作日 08:00 抓取公开 RSS，生成带来源链接的 Markdown 和配图，再使用 WenYan 上传到微信公众号草稿箱。

## 手动运行

```bash
/root/wechat-daily/scripts/run-daily.sh
```

任务只调用草稿接口，不调用正式发表接口。`.env` 只保存在服务器，不提交 Git。

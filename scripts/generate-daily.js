#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";

const root = process.cwd();
const date = process.argv[2] || new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const outputDir = path.join(root, date);
const themes = ["default", "orangeheart", "rainbow", "lapis", "pie", "maize", "purple", "phycat"];
const theme = themes[Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) % themes.length];
const nextWorkday = new Date(`${date}T00:00:00Z`);
do {
  nextWorkday.setUTCDate(nextWorkday.getUTCDate() + 1);
} while (nextWorkday.getUTCDay() === 0 || nextWorkday.getUTCDay() === 6);
const nextDate = nextWorkday.toISOString().slice(0, 10);
const feeds = [
  ["明日美国政策与美联储", `US Federal Reserve OR US policy markets ${nextDate}`],
  ["明日美国经济数据", `US CPI PCE jobs report economic calendar ${nextDate}`],
  ["明日科技公司", `technology stocks earnings AI chip company events ${nextDate}`],
];

function decodeXml(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function tag(item, name) {
  const match = item.match(new RegExp(`<${name}(?:[^>]*)>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1].replace(/<[^>]+>/g, "")) : "";
}

async function fetchFeed(label, query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, { headers: { "user-agent": "wechat-daily/1.0" } });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 5).map((match) => ({
    label, title: tag(match[1], "title"), link: tag(match[1], "link"), date: tag(match[1], "pubDate"),
  })).filter((item) => item.title && item.link);
}

function safe(value) {
  return value.replace(/[\\[\]_*`]/g, "\\$&");
}

async function createImage(file, text, background) {
  const font = execFileSync("fc-match", ["-f", "%{file}", "Noto Sans CJK SC"], { encoding: "utf8" });
  await new Promise((resolve, reject) => {
    const process = spawn("convert", [
      "-size", "900x383", `xc:${background}`, "-font", font, "-fill", "white",
      "-pointsize", "46", "-gravity", "center", "-annotate", "+0+0", text, file,
    ], { stdio: "ignore" });
    process.on("error", reject);
    process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`convert exited ${code}`)));
  });
}

await fs.mkdir(outputDir, { recursive: true });
const results = await Promise.allSettled(feeds.map(([label, query]) => fetchFeed(label, query)));
const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
const recent = items.filter((item) => Number.isFinite(Date.parse(item.date)) && Date.parse(item.date) >= cutoff);
const unique = [...new Map(recent.map((item) => [item.title, item])).values()].slice(0, 12);
if (unique.length < 3) throw new Error("公开资讯源返回不足 3 条，已停止生成，避免上传空稿");

await createImage(path.join(outputDir, "封面.png"), "明日美股与宏观资讯", "#18324b");
await createImage(path.join(outputDir, "政策与利率.png"), "明日政策与利率", "#7d3f3f");
await createImage(path.join(outputDir, "宏观数据.png"), "明日宏观数据", "#315f4c");
await createImage(path.join(outputDir, "科技公司.png"), "明日科技公司", "#59447d");

const grouped = feeds.map(([label]) => [label, unique.filter((item) => item.label === label)]).filter(([, group]) => group.length);
const sections = grouped.map(([label, group]) => {
  const image = label === "明日美国政策与美联储" ? "政策与利率.png" : label === "明日美国经济数据" ? "宏观数据.png" : "科技公司.png";
  const lines = group.slice(0, 4).map((item) => `- [${safe(item.title)}](${item.link})（${new Date(item.date).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}）`);
  return `## ${label}\n\n![${label}](./${image})\n\n${lines.join("\n")}\n`;
}).join("\n");

const markdown = `---
title: 明日美股与宏观资讯｜${nextDate}
cover: ./封面.png
need_open_comment: 1
only_fans_can_comment: 0
---

> 本文提示下一个工作日（${nextDate}）值得关注的美股、黄金与加密资产相关资讯；仅使用已公开的日程、预告和来源链接。

${sections}

## 阅读提示

- 仅纳入公开来源可核实的明日事件、日程、预告和链接。
- 本文不补写未经来源支持的价格、涨跌幅或概率。
- 具体影响仍需结合公司公告、监管文件和市场交易数据判断。

本文为公开资讯整理，不构成投资建议。
`;
await fs.writeFile(path.join(outputDir, "发布.md"), markdown, "utf8");
console.log(JSON.stringify({ date, theme, count: unique.length, outputDir }));

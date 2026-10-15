#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import playwright from "../tools/node_modules/playwright/index.js";

const { chromium } = playwright;

const root = process.cwd();
const date = process.argv[2] || new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const outputDir = path.join(root, date);
const themes = ["default", "orangeheart", "rainbow", "lapis", "pie", "maize", "purple", "phycat"];
const theme = themes[Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000) % themes.length];
const nextDate = new Date(`${date}T00:00:00Z`);
nextDate.setUTCDate(nextDate.getUTCDate() + 1);
const nextDateValue = nextDate.toISOString().slice(0, 10);
const earningsUrl = `https://api.nasdaq.com/api/calendar/earnings?date=${date}`;

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function formatBeijing(hour, minute) {
  return `北京时间${date.slice(5).replace("-", "月")}日 ${hour}:${String(minute).padStart(2, "0")}`;
}

function easternOffset(dateValue) {
  const text = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", timeZoneName: "longOffset", hour: "numeric",
  }).format(new Date(`${dateValue}T12:00:00Z`));
  return text.includes("-04:00") ? -4 : -5;
}

function marketTimes() {
  const offset = easternOffset(date);
  return [
    { time: formatBeijing(offset === -4 ? 21 : 22, 30), event: "美股常规交易开盘（美东 9:30）", detail: "这是交易时段开始，不代表已经发生涨跌。", source: "纽约证券交易所交易时段说明", url: "https://www.nyse.com/markets/hours-calendars" },
    { time: `北京时间次日 ${offset === -4 ? "04:00" : "05:00"}`, event: "美股常规交易收盘（美东 16:00）", detail: "出稿时尚未发生，只写成将要收盘。", source: "纽约证券交易所交易时段说明", url: "https://www.nyse.com/markets/hours-calendars" },
  ];
}

async function fetchEarnings() {
  const response = await fetch(earningsUrl, { headers: { "user-agent": "wechat-daily/2.0", accept: "application/json" } });
  if (!response.ok) throw new Error(`Nasdaq earnings HTTP ${response.status}`);
  const rows = (await response.json())?.data?.rows || [];
  const techPattern = /AI|chip|semiconductor|software|cloud|technology|internet|digital|systems|data|electronics|通信|科技/i;
  return rows.filter((row) => {
    const timing = String(row.time || "").toLowerCase();
    return techPattern.test(`${row.name} ${row.symbol}`) && (timing.includes("before") || timing.includes("after"));
  }).slice(0, 6).map((row) => {
    const afterClose = String(row.time).toLowerCase().includes("after");
    return {
      time: afterClose ? `北京时间次日 ${easternOffset(date) === -4 ? "04:00" : "05:00"} 后` : `北京时间${date.slice(5).replace("-", "月")}日 21:30 前`,
      event: `${row.name}（${row.symbol}）公布财报`,
      detail: `日历标注为${afterClose ? "美东收盘后" : "美东开盘前"}；出稿时不把 EPS 预测写成结果。`,
      source: "Nasdaq Earnings Calendar",
      url: earningsUrl,
      company: row.name,
      symbol: row.symbol,
    };
  });
}

async function fetchNextFomc() {
  const url = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
  const response = await fetch(url, { headers: { "user-agent": "wechat-daily/2.0" } });
  if (!response.ok) throw new Error(`FOMC calendar HTTP ${response.status}`);
  const html = await response.text();
  const year = date.slice(0, 4);
  const nextYear = String(Number(year) + 1);
  const block = html.match(new RegExp(`${year} FOMC Meetings([\\s\\S]*?)(?:${nextYear} FOMC Meetings)`))?.[1] || "";
  const monthNumbers = { January: 1, April: 4, July: 7, October: 10 };
  const meetings = [...block.matchAll(/<div class="fomc-meeting__month[^>]*><strong>([^<]+)<\/strong>[\s\S]*?<div class="fomc-meeting__date[^>]*>([^<]+)<\/div>/g)]
    .slice(0, 4).map((match) => ({ month: monthNumbers[match[1]], day: Number(match[2].split("-")[0]) }))
    .filter((meeting) => meeting.month && Number.isFinite(meeting.day));
  const current = Date.parse(`${date}T00:00:00Z`);
  const next = meetings.find((meeting) => Date.UTC(Number(year), meeting.month - 1, meeting.day) >= current);
  if (!next) return "美联储官方日历尚未列出下一场会议";
  return `${year}年${next.month}月${next.day}日至${next.day + 1}日`;
}

async function renderCard(file, title, lines, background, width, height) {
  const browser = await chromium.launch({ headless: true, args: ["--headless=new", "--disable-gpu", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width, height } });
  const html = `<html><head><meta charset="utf-8"><style>
    @font-face { font-family: cjk; src: url("file:///usr/share/fonts/google-noto-cjk/NotoSansCJKsc-Regular.otf"); }
    * { box-sizing: border-box; } body { margin: 0; width: ${width}px; min-height: ${height}px; padding: 52px 64px; background: ${background}; color: #f8fafc; font-family: cjk, sans-serif; }
    h1 { font-size: 42px; margin: 0 0 30px; letter-spacing: 1px; } p { font-size: 25px; line-height: 1.7; margin: 14px 0; } .line { border-top: 1px solid rgba(255,255,255,.3); padding-top: 18px; margin-top: 18px; }
  </style></head><body><h1>${escapeHtml(title)}</h1>${lines.map((line) => `<p class="line">${escapeHtml(line)}</p>`).join("")}</body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  if (width === 900) {
    await page.screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }
  await browser.close();
}

const events = marketTimes();
try {
  events.push(...await fetchEarnings());
} catch (error) {
  console.error(`Earnings calendar unavailable: ${error.message}`);
}
let nextFomc = "美联储官方日历暂时不可用";
try {
  nextFomc = await fetchNextFomc();
} catch (error) {
  console.error(`FOMC calendar unavailable: ${error.message}`);
}
await fs.mkdir(outputDir, { recursive: true });

const companyEvents = events.filter((event) => event.company);
const firstEvent = companyEvents[0] || events[0];
const title = companyEvents[0]
  ? `${companyEvents[0].time} ${companyEvents[0].company}财报预告`
  : `${formatBeijing(easternOffset(date) === -4 ? 21 : 22, 30)}美股开盘及今晚日程`;
const summary = companyEvents.length
  ? `接下来先看${companyEvents[0].company}（${companyEvents[0].symbol}）财报。同一窗口还有美股开盘和收盘。相关时间会碰到科技股、利率预期、黄金和比特币，但出稿时没有结果。`
  : "接下来先看美股开盘。同一窗口还要看美股收盘前后的已排定日程。出稿时没有核对到大型科技公司财报，黄金和比特币只作利率敏感资产提示。";
const timetable = events.map((event) => `- ${event.time}：**${event.event}**。${event.detail}`);
const companies = companyEvents.length
  ? companyEvents.map((event) => `- **${event.company}（${event.symbol}）**：财报时间已由 Nasdaq 日历列出，影响要等事件发生后才能判断。`)
  : ["- 这一天没有其他已核对的大型科技财报。"];
const sources = [...new Map(events.map((event) => [event.source, event.url])).entries()];
sources.push(["美联储 FOMC 日历", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"]);

await renderCard(path.join(outputDir, "封面.png"), `${date} 日程预告`, [firstEvent.time, firstEvent.event, ...events.slice(1, 3).map((event) => event.time)], "#172554", 900, 383);
await renderCard(path.join(outputDir, "图1.png"), "时间表（北京时间）", events.slice(0, 6).map((event) => `${event.time}｜${event.event}`), "#164e63", 1080, 420);
await renderCard(path.join(outputDir, "图2.png"), "最重要的一件事", [firstEvent.time, firstEvent.event, firstEvent.detail], "#713f12", 1080, 420);
await renderCard(path.join(outputDir, "图3.png"), "会碰到的公司", companyEvents.length ? companyEvents.map((event) => `${event.company}（${event.symbol}）｜财报日程`) : ["没有已核对的大型科技财报"], "#3f3f46", 1080, 420);

const markdown = `---
title: ${title.slice(0, 64)}
cover: ./封面.png
need_open_comment: 1
only_fans_can_comment: 0
---

${summary}

> ${firstEvent.time}，${firstEvent.event}。这是出稿时已经核对、但尚未发生的事项。

## 时间表

${timetable.join("\n")}

![这一天的时间表](./图1.png)

## 最重要的一件事

${firstEvent.time}，**${firstEvent.event}**。${firstEvent.detail}公司自己的宣传数字如果后续出现，必须等原始发布后再核对；出稿时不把预测写成结果。

![最重要事件](./图2.png)

## 数据和利率

出稿时只保留窗口内已经核对的公开日程。窗口内没有从美国联邦储备委员会和美国劳工统计局日历核对到的临时数据或讲话，因此不编造公布数字或市场概率。下一场议息会议是 **${nextFomc}**，不是今天。今晚的利率或数据会碰到黄金和比特币，出稿时还没有这场的结果。

## 会碰到的公司

${companies.join("\n")}

![会碰到的公司](./图3.png)

## 来源

来源：${sources.map(([name, url]) => `[${name}](${url})`).join("、")}。本文写的是尚未发生的日程。

本文为公开资讯整理，不构成投资建议。
`;
await fs.writeFile(path.join(outputDir, "发布.md"), markdown, "utf8");
console.log(JSON.stringify({ date, nextDate: nextDateValue, theme, eventCount: events.length, companyCount: companyEvents.length, outputDir }));

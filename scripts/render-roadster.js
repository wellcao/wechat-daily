#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import playwright from "../tools/node_modules/playwright/index.js";

const { chromium } = playwright;
const execFileAsync = promisify(execFile);
const outputDir = path.join(process.cwd(), "2026-10-16");

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

async function render(file, title, lines, background, width, height) {
  const browser = await chromium.launch({ headless: true, args: ["--headless=new", "--disable-gpu", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width, height } });
  const html = `<html><head><meta charset="utf-8"><style>
    @font-face { font-family: cjk; src: url("file:///usr/share/fonts/google-noto-cjk/NotoSansCJKsc-Regular.otf"); }
    * { box-sizing: border-box; } body { margin: 0; width: ${width}px; min-height: ${height}px; padding: 52px 64px; background: ${background}; color: #f8fafc; font-family: cjk, sans-serif; } h1 { font-size: 42px; line-height: 1.3; margin: 0 0 28px; } p { font-size: 25px; line-height: 1.65; margin: 14px 0; border-top: 1px solid rgba(255,255,255,.3); padding-top: 16px; }
  </style></head><body><h1>${escapeHtml(title)}</h1>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: file, fullPage: width !== 900 });
  await browser.close();
}

await fs.mkdir(outputDir, { recursive: true });
await render(path.join(outputDir, "封面.png"), "Tesla Roadster：飞起来了，但还没交付", ["10月16日｜SpaceX推进器演示", "约1秒破百｜翻转｜落地", "真正的考题：量产时间与价格"], "#111827", 900, 383);
await render(path.join(outputDir, "图1.png"), "发布会表现", ["现场展示飞跃、翻转和受控落地", "展示车辆越过Cybercab、Cybertruck、Semi、Model Y和Model 3", "马斯克称0—60英里/小时约1秒"], "#172554", 1080, 430);
await render(path.join(outputDir, "图2.png"), "用到的技术", ["SpaceX冷气推进器：约10个小型推进器", "高功率风扇与推进器协同完成动作", "技术亮点很强，但道路法规、维护和量产方案仍待确认"], "#164e63", 1080, 430);
await render(path.join(outputDir, "图3.png"), "九年延期时间线", ["2017：公布二代Roadster，目标2020交付", "2025—2026：2025年、4月1日、4月底、8月、10月1日、10月15日多次改期", "现在：完成演示，但交付日期仍是关键问题"], "#713f12", 1080, 430);
await render(path.join(outputDir, "图4.png"), "我的判断", ["超出预期：舞台效果和工程演示明显超出普通电动车发布会", "没有完全超出预期：续航、最高时速、价格、量产和交付仍未同时给出", "Roadster更像品牌与技术的Halo项目，而不是短期收入主引擎"], "#3f3f46", 1080, 500);

const browser = await chromium.launch({ headless: true, args: ["--headless=new", "--disable-gpu", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
const imageData = async (name) => `data:image/png;base64,${(await fs.readFile(path.join(outputDir, name))).toString("base64")}`;
const cover = await imageData("封面.png");
const images = await Promise.all(["图1.png", "图2.png", "图3.png", "图4.png"].map(imageData));
const html = `<html><head><meta charset="utf-8"><style>
  @font-face { font-family: cjk; src: url("file:///usr/share/fonts/google-noto-cjk/NotoSansCJKsc-Regular.otf"); } * { box-sizing: border-box; } body { margin: 0; width: 900px; background: #f5f5f5; font-family: cjk, sans-serif; color: #222; } img { width: 100%; display: block; } section { background: white; padding: 28px 40px; } h1 { font-size: 30px; margin: 0 0 14px; } h2 { font-size: 23px; border-left: 5px solid #2563eb; padding-left: 10px; margin: 20px 0 10px; } p { font-size: 17px; line-height: 1.5; color: #555; margin: 7px 0; } .source { font-size: 14px; color: #777; word-break: break-all; }
</style></head><body><img src="${cover}"><section><h1>Tesla Roadster：飞起来了，但还没交付</h1><p>特斯拉这次把最受争议的技术真的搬上了舞台，但发布会的震撼感，还没有自动变成量产承诺。</p><h2>发布会表现</h2><img src="${images[0]}"><h2>技术与边界</h2><img src="${images[1]}"><h2>延期时间线</h2><img src="${images[2]}"><h2>我的判断</h2><img src="${images[3]}"><p class="source">来源：Tesla Roadster官网、TechCrunch、Axios、Electrek。本文为公开资讯整理，不构成投资建议。</p></section></body></html>`;
await page.setContent(html, { waitUntil: "load" });
await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
const previewPng = path.join(outputDir, "预览.png");
await page.screenshot({ path: previewPng, fullPage: true });
await browser.close();
await execFileAsync("convert", [previewPng, "-resize", "700x", "-quality", "72", path.join(outputDir, "预览.jpg")]);

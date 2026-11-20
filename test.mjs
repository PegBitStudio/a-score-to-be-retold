import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { createServer } from "node:http";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");

if (/innerHTML\s*=/.test(html)) throw new Error("user text must not be assigned with innerHTML");
if (!html.includes("<noscript>")) throw new Error("score must remain readable with scripts off");

const proposal = html.match(/const PROPOSAL = "([\s\S]*?)";/);
if (!proposal) throw new Error("proposal missing");
const text = proposal[1].replace(/\\n/g, "\n");
if (text.length > 750 || text.length < 600) throw new Error("proposal length " + text.length);

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForSelector("text=Speak this one today.");
const score = await page.locator("#score").innerText();
if (!score.includes("A SCORE TO BE RETOLD")) throw new Error("score missing");
if (!score.includes("speak this one")) throw new Error("today not marked");
await page.fill("#retelling", "I kept the point.");
const after = await page.locator("#score").innerText();
if (!after.includes("I kept the point.")) throw new Error("retelling did not enter the score");
await page.click("#bare");
if (!(await page.locator("text=The drawing has been set down.").count())) throw new Error("bare mode failed");
await page.click("#bare");
await page.click("text=Rewrite them");
await page.fill('[aria-label="Sentence 1"]', "A line of my own.");
const rewritten = await page.locator("#score").innerText();
if (!rewritten.includes("1. A line of my own.")) throw new Error("rewrite failed");
if (errors.length) throw new Error(errors.join("\n"));
await browser.close();
server.close();
console.log("publish checks ok", text.length);

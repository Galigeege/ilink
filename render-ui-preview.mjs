import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const page = await browser.newPage({
  viewport: { width: 1500, height: 1180 },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(resolve("ilink-ui-directions.html")).href);
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
await page.screenshot({ path: "ilink-ui-directions-preview.png", fullPage: true });

for (const screen of ["week", "family"]) {
  await page.locator(`[data-target="${screen}"]`).click();
  const activeScreens = await page.locator(`.screen.active[data-screen="${screen}"]`).count();
  const activeNotes = await page.locator(`.screen-note.active[data-note="${screen}"]`).count();
  if (activeScreens !== 3 || activeNotes !== 3) {
    throw new Error(`${screen}: expected 3 active screens and notes`);
  }
  await page.screenshot({ path: `ilink-ui-${screen}-preview.png`, fullPage: true });
}

const mobile = await browser.newPage({ viewport: { width: 430, height: 932 } });
await mobile.goto(pathToFileURL(resolve("ilink-ui-directions.html")).href);
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
if (overflow) throw new Error("mobile layout has horizontal page overflow");
await mobile.screenshot({ path: "ilink-ui-mobile-preview.png", fullPage: false });

if (errors.length) throw new Error(`browser console errors: ${errors.join(" | ")}`);
console.log("UI_CHECK_OK: desktop tabs, mobile width, and browser console verified");

await browser.close();

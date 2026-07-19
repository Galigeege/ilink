import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const url = pathToFileURL(resolve("ilink-app-prototype.html")).href;
const indexUrl = pathToFileURL(resolve("index.html")).href;

async function verifyPage(page, label) {
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("ERR_FAILED")) errors.push(message.text());
  });
  await page.goto(url);
  if (await page.locator(".app.capture-mode .capture-home").count() !== 1) {
    throw new Error(`${label}: capture-only opening screen missing`);
  }
  if (await page.locator(".bottom-nav .nav-btn").count() !== 3) {
    throw new Error(`${label}: expected three core bottom tabs`);
  }
  if (await page.locator('[data-nav="capture"].active[aria-current="page"]').count() !== 1) {
    throw new Error(`${label}: voice capture is not the default tab`);
  }
  if (!await page.locator(".capture-mode .bottom-nav").isVisible()) {
    throw new Error(`${label}: bottom tabs missing on capture screen`);
  }
  const captureMetrics = await page.evaluate(() => ({
    recordBottom: document.querySelector(".record-dock").getBoundingClientRect().bottom,
    navTop: document.querySelector(".bottom-nav").getBoundingClientRect().top,
  }));
  if (captureMetrics.recordBottom > captureMetrics.navTop + 5) throw new Error(`${label}: recorder overlaps navigation`);
  if (await page.locator('[data-nav="today"], [data-nav="review"], [data-nav="me"]').count() !== 0) throw new Error(`${label}: legacy tabs are still present`);
  for (const screen of ["daily", "family"]) {
    await page.locator(`[data-nav="${screen}"]`).click();
    if (await page.locator(`.page.active[data-page="${screen}"]`).count() !== 1) {
      throw new Error(`${label}: ${screen} navigation failed`);
    }
  }
  if (errors.length) throw new Error(`${label}: ${errors.join(" | ")}`);
  const metrics = await page.evaluate(() => ({
    viewport: innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    tabs: document.querySelectorAll(".bottom-nav .nav-btn").length,
  }));
  if (metrics.pageWidth > metrics.viewport) throw new Error(`${label}: horizontal overflow`);
  await page.locator('[data-nav="capture"]').click();
  if (await page.locator(".app.capture-mode").count() !== 1 || !(await page.locator(".record-dock").isVisible())) throw new Error(`${label}: capture tab did not reopen voice input`);
  return {...metrics,...captureMetrics};
}

const entry = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await entry.goto(indexUrl);
await entry.waitForURL(url);
if (!(await entry.locator('.app.capture-mode').isVisible())) throw new Error("GitHub Pages index did not open the iLink prototype");
await entry.close();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
console.log("desktop", await verifyPage(desktop, "desktop"));
await desktop.reload();
await desktop.screenshot({ path: "ilink-app-prototype-desktop.png", fullPage: false });
if (await desktop.locator('.presentation-switch').count() !== 0) throw new Error("legacy page-switch control is still present");
if (await desktop.locator('.language-switch [data-lang]').count() !== 2) throw new Error("Chinese/English language switch is missing");
const pageStoryMetrics = await desktop.evaluate(() => ({ viewportHeight: innerHeight, pageHeight: document.documentElement.scrollHeight }));
if (pageStoryMetrics.pageHeight < pageStoryMetrics.viewportHeight * 1.7) throw new Error(`App and hardware are not arranged as a scroll page: ${JSON.stringify(pageStoryMetrics)}`);
await desktop.locator('[data-lang="en"]').click();
if ((await desktop.locator('.hardware-title h1').innerText()).includes('生活发生时')) throw new Error("English language switch did not translate the page");
await desktop.locator('[data-lang="zh"]').click();
if ((await desktop.locator('.hardware-caption').innerText()).includes('capture point')) throw new Error("Chinese language switch left English copy behind");
await desktop.locator('.hardware-story').evaluate(element => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, element.offsetTop); });
await desktop.waitForTimeout(350);
if (!(await desktop.locator('.hardware-story').isVisible())) throw new Error("hardware interaction section is not visible in the scroll story");
if (await desktop.locator('.hardware-step').count() !== 5) throw new Error("hardware interaction flow must contain five steps");
if (await desktop.getByText('不拍视频，不保存全天轨迹；').count() !== 0) throw new Error("deleted capture-contract copy is still present");
if (!(await desktop.locator('.glasses-button').isVisible()) || !(await desktop.locator('.tap-gesture').isVisible())) throw new Error("glasses capture button or tap gesture is missing");
if ((await desktop.locator('.contact-link').getAttribute('href')) !== 'mailto:founder@weiproduct.com') throw new Error("contact email link is missing or invalid");
await desktop.locator('.glasses-button').click();
if ((await desktop.locator('.loop-status-copy').textContent()) !== '已捕捉 1 帧') throw new Error("glasses capture interaction did not update status");
const hardwareMetrics = await desktop.evaluate(() => ({
  imageWidth: document.querySelector('.glasses-image').naturalWidth,
  imageHeight: document.querySelector('.glasses-image').naturalHeight,
  viewportWidth: innerWidth,
  pageWidth: document.documentElement.scrollWidth,
  trustRules: document.querySelectorAll('.trust-item').length,
}));
if (!hardwareMetrics.imageWidth || !hardwareMetrics.imageHeight) throw new Error(`smart-glasses hero failed to load: ${JSON.stringify(hardwareMetrics)}`);
if (hardwareMetrics.pageWidth > hardwareMetrics.viewportWidth) throw new Error(`hardware page horizontal overflow: ${JSON.stringify(hardwareMetrics)}`);
if (hardwareMetrics.trustRules !== 3) throw new Error("hardware page is missing privacy boundaries");
console.log("hardware", hardwareMetrics);
await desktop.screenshot({ path: "ilink-app-prototype-hardware-desktop.png", fullPage: false });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
console.log("mobile", await verifyPage(mobile, "mobile"));
await mobile.reload();
await mobile.screenshot({ path: "ilink-app-prototype-mobile.png", fullPage: false });
await mobile.locator(".record-control").dispatchEvent("pointerdown", { button: 0, pointerId: 1 });
await mobile.waitForTimeout(700);
await mobile.screenshot({ path: "ilink-app-prototype-recording.png", fullPage: false });
await mobile.locator(".record-control").dispatchEvent("pointerup", { button: 0, pointerId: 1 });
await mobile.waitForTimeout(900);
if (await mobile.locator(".sheet-backdrop.open").count() !== 1) throw new Error("record confirmation sheet did not open");
await mobile.screenshot({ path: "ilink-app-prototype-confirm.png", fullPage: false });
await mobile.locator('[data-action="save-event"]').click();
if (await mobile.locator(".app.capture-mode").count() !== 0) throw new Error("saving did not enter daily organization");
if (!await mobile.locator('.page.active[data-page="daily"]').isVisible() || await mobile.locator('.organize-card').count() !== 4) throw new Error("daily organization page is incomplete");
if (!(await mobile.locator('.my-day-view').isVisible()) || await mobile.locator('.my-view-tab').count() !== 2) throw new Error("My page day/share tabs are missing");
await mobile.screenshot({ path: "ilink-app-prototype-daily.png", fullPage: false });
await mobile.locator('[data-action="confirm-day"]').click();
if ((await mobile.locator('.daily-status').textContent()) !== '4 / 4 已确认') throw new Error("daily confirmation flow failed");
await mobile.locator('[data-action="daily-share"]').click();
if (await mobile.locator(".share-backdrop.open").count() !== 1) throw new Error("daily sharing card editor did not open");
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: "ilink-app-prototype-share-card.png", fullPage: false });
await mobile.locator('[data-action="close-share"]').click();
await mobile.waitForTimeout(1900);
await mobile.locator('[data-nav="family"]').click();
await mobile.screenshot({ path: "ilink-app-prototype-family.png", fullPage: false });
if (!(await mobile.locator('.family-focus-view').isVisible()) || await mobile.locator('[data-attention-panel="week"] .attention-card').count() !== 3) throw new Error("weekly family attention summary is missing");
await mobile.locator('[data-family-range="month"]').click();
await mobile.waitForTimeout(150);
if (!(await mobile.locator('[data-attention-panel="month"]').isVisible()) || await mobile.locator('[data-attention-panel="month"] .attention-card').count() !== 4) throw new Error("monthly family attention summary is missing");
await mobile.screenshot({ path: "ilink-app-prototype-family-month.png", fullPage: false });
await mobile.locator('[data-family-view="members"]').click();
if (await mobile.locator('.family-cell[data-family]').count() !== 2) throw new Error("family member list is missing");
await mobile.locator('[data-family="mother"]').click();
if (!(await mobile.locator('.family-detail-view').isVisible()) || await mobile.locator('.family-detail-view .share-entry').count() !== 2) throw new Error("mother received sharing history failed");
if (await mobile.locator('.direction-tab').count() !== 0 || await mobile.locator('.family-detail-view .share-entry.sent').count() !== 0) throw new Error("family detail must only show shares received from family");
await mobile.screenshot({ path: "ilink-app-prototype-family-mother.png", fullPage: false });
await mobile.locator('.family-detail-view .back-btn').click();
await mobile.locator('[data-family="father"]').click();
if ((await mobile.locator('.detail-title').textContent()) !== '爸爸' || await mobile.locator('.family-detail-view .share-entry').count() !== 2) throw new Error("father received sharing history failed");
await mobile.screenshot({ path: "ilink-app-prototype-family-father.png", fullPage: false });

const clean = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await clean.goto(url);
await clean.locator('[data-nav="daily"]').click();
await clean.waitForTimeout(350);
if ((await clean.locator('#daily-title').textContent()) !== '我' || !(await clean.locator('.my-day-view').isVisible())) throw new Error("third tab did not open My Day");
const myDayLayout = await clean.evaluate(() => ({
  scrollTop: document.querySelector('.page[data-page="daily"]').scrollTop,
  headerTop: document.querySelector('.page[data-page="daily"] .page-header').getBoundingClientRect().top,
  headerVisible: getComputedStyle(document.querySelector('.page[data-page="daily"] .page-header')).display !== 'none',
}));
if (myDayLayout.scrollTop !== 0 || !myDayLayout.headerVisible || myDayLayout.headerTop < 35) throw new Error(`My Day header layout failed: ${JSON.stringify(myDayLayout)}`);
await clean.screenshot({ path: "ilink-app-prototype-daily.png", fullPage: false });
await clean.locator('[data-my-view="shares"]').click();
if (!(await clean.locator('.my-shares-view').isVisible()) || await clean.locator('.my-share-stream .share-entry.sent').count() !== 3) throw new Error("My Shares history is missing");
await clean.screenshot({ path: "ilink-app-prototype-my-shares.png", fullPage: false });
await clean.locator('[data-nav="family"]').click();
await clean.waitForTimeout(350);
if (!(await clean.locator('.family-focus-view').isVisible()) || !(await clean.locator('[data-attention-panel="week"]').isVisible())) throw new Error("clean family attention summary is not visible");
await clean.screenshot({ path: "ilink-app-prototype-family.png", fullPage: false });
await clean.locator('[data-attention-family="mother"]').first().click();
if (!(await clean.locator('.family-detail-view').isVisible()) || (await clean.locator('.detail-title').textContent()) !== '妈妈') throw new Error("attention item did not open supporting family records");
await clean.locator('.family-detail-view .back-btn').click();
await clean.locator('[data-family-view="members"]').click();
if (!(await clean.locator('[data-family="mother"]').isVisible())) throw new Error("family member list is not visible");
await clean.screenshot({ path: "ilink-app-prototype-family-members.png", fullPage: false });
await clean.locator('[data-family="mother"]').click();
await clean.waitForTimeout(250);
if (await clean.locator('.direction-tab').count() !== 0 || await clean.locator('.family-detail-view .share-entry.sent').count() !== 0) throw new Error("family detail contains outgoing shares");
await clean.screenshot({ path: "ilink-app-prototype-family-mother.png", fullPage: false });
await clean.locator('.family-detail-view .back-btn').click();
await clean.locator('[data-family="father"]').click();
await clean.waitForTimeout(250);
await clean.screenshot({ path: "ilink-app-prototype-family-father.png", fullPage: false });

await clean.locator('[data-nav="daily"]').click();
await clean.locator('[data-my-view="day"]').click();
await clean.locator('.page.active[data-page="daily"] [data-action="manage"]').click();
await clean.waitForTimeout(250);
if (await clean.locator('.manage-card').count() !== 3) throw new Error("management centers are missing from My page");
await clean.screenshot({ path: "ilink-app-prototype-me.png", fullPage: false });
await clean.locator('[data-action="close-manage"]').click();
if (!await clean.locator('.page.active[data-page="daily"]').isVisible()) throw new Error("management back action did not return to daily organization");

const agent = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await agent.goto(url);
await agent.locator('[data-voice-intent="share"]').click();
await agent.waitForTimeout(550);
if ((await agent.locator('.intent-kind').textContent()) !== '生成分享卡') throw new Error("voice share intent was not recognized");
await agent.screenshot({ path: "ilink-app-prototype-agent-share-intent.png", fullPage: false });
await agent.locator('.intent-primary').click();
if (!await agent.locator('.share-backdrop.open').isVisible()) throw new Error("voice share intent did not open card editor");
await agent.locator('[data-action="close-share"]').click();
await agent.locator('[data-nav="capture"]').click();
await agent.locator('[data-voice-intent="family"]').click();
await agent.waitForTimeout(550);
if ((await agent.locator('.intent-kind').textContent()) !== '查看家人信息') throw new Error("voice family intent was not recognized");
await agent.locator('.intent-primary').click();
if (!(await agent.locator('.family-detail-view').isVisible()) || (await agent.locator('.detail-title').textContent()) !== '爸爸') throw new Error("voice family intent did not open father detail");
await agent.waitForTimeout(450);
const agentFamilyScroll = await agent.evaluate(() => ({ page: document.querySelector('.page[data-page="family"]').scrollTop, app: document.querySelector('.app').scrollTop, window: scrollY, appHeight: document.querySelector('.app').getBoundingClientRect().height, pageHeight: document.querySelector('.page[data-page="family"]').getBoundingClientRect().height, viewport: innerHeight }));
if (agentFamilyScroll.page !== 0 || agentFamilyScroll.window !== 0 || agentFamilyScroll.appHeight < 700) throw new Error(`voice family result layout mismatch: ${JSON.stringify(agentFamilyScroll)}`);
await agent.screenshot({ path: "ilink-app-prototype-agent-family-result.png", fullPage: false });

await browser.close();
console.log("APP_UI_CHECK_OK: Family/Record/My navigation, received-only family history, My Day, My Shares, management, and voice-agent intents verified");

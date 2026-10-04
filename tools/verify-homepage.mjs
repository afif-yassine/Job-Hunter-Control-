import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = process.env.HOME_TEST_ORIGIN || "http://localhost:3000";
const output = "test-results/homepage";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const findings = [];
try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      colorScheme: "dark",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`${origin}/accueil`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.locator("h1").waitFor();
    await page.locator("[data-home-opening]").waitFor({ state: "hidden" });
    // Reveal each section as a visitor scrolls before capturing the whole page.
    async function revealSections() {
      for (const section of await page.locator("[data-reveal]").all()) {
        await section.scrollIntoViewIfNeeded();
        await section.evaluate(
          (element) =>
            new Promise((resolve) => {
              if (element.dataset.revealed) {
                resolve();
                return;
              }
              const observer = new MutationObserver(() => {
                if (element.dataset.revealed) {
                  observer.disconnect();
                  resolve();
                }
              });
              observer.observe(element, {
                attributes: true,
                attributeFilter: ["data-revealed"],
              });
            }),
        );
      }
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter(
              (animation) =>
                animation.effect?.getTiming().iterations !== Infinity,
            )
            .map((animation) => animation.finished.catch(() => {})),
        ),
      );
      await page.evaluate(() => scrollTo(0, 0));
    }
    await revealSections();
    const theme = page.locator("[data-theme]").first();
    assert.equal(
      await theme.getAttribute("data-theme"),
      "light",
      "New visitors start in light, even with a dark OS",
    );
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll("main *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width && (r.right > innerWidth + 2 || r.left < -2);
        })
        .map((el) => ({
          tag: el.tagName,
          class: el.className,
          text: el.textContent?.slice(0, 60),
        })),
    );
    if ([1440, 390, 320].includes(width))
      await page.screenshot({
        path: `${output}/light-${width}.png`,
        fullPage: true,
      });
    await page.getByRole("button", { name: "Un stage", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Un stage", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page
        .getByRole("heading", { name: "Assistant·e data analyst" })
        .count(),
      1,
    );
    await page.getByRole("button", { name: "Activer le thème sombre" }).click();
    assert.equal(await theme.getAttribute("data-theme"), "dark");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page.locator("[data-home-opening]").count(),
      0,
      "Intro does not replay during the session",
    );
    await revealSections();
    assert.equal(
      await theme.getAttribute("data-theme"),
      "dark",
      "Theme survives reload with SSR",
    );
    if ([1440, 390].includes(width))
      await page.screenshot({
        path: `${output}/dark-${width}.png`,
        fullPage: true,
      });
    await page
      .getByText("Est-ce que LeBonTaf postule à ma place ?", { exact: true })
      .click();
    assert.equal(await page.locator("details[open]").count(), 1);
    assert.equal(
      await page
        .getByRole("link", { name: "Trouver mon bon taf" })
        .first()
        .getAttribute("href"),
      "/login",
    );
    const brokenAnchors = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => a.getAttribute("href"))
        .filter((href) => !document.getElementById(href.slice(1))),
    );
    assert.deepEqual(brokenAnchors, []);
    await page
      .getByRole("button", { name: "Revoir le premier chapitre" })
      .click();
    await page.locator("[data-home-opening]").waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Passer l’introduction" }).click();
    assert.equal(
      await page.locator("[data-home-opening]").count(),
      0,
      "Intro can be replayed and skipped",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    const moving = await page.evaluate(
      () =>
        [...document.querySelectorAll("[data-theme] *")].filter(
          (el) => getComputedStyle(el).animationName !== "none",
        ).length,
    );
    assert.equal(moving, 0, "Reduced motion disables decorative animations");
    findings.push({ width, overflow, errors, interactions: "passed" });
    await context.close();
  }
  await writeFile(`${output}/report.json`, JSON.stringify(findings, null, 2));
  console.log(JSON.stringify(findings, null, 2));
  assert(
    findings.every((item) => !item.overflow.length && !item.errors.length),
    "See overflow or browser errors in report",
  );
} finally {
  await browser.close();
}

import { chromium } from "playwright";
import { createServer } from "node:http";
import { isIP } from "node:net";
const port = Number(process.env.PORT || 3001),
  secret = process.env.WORKER_SHARED_SECRET;
function allowed(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || isIP(h)) return false;
    return true;
  } catch {
    return false;
  }
}
const server = createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/health") {
    res.end(JSON.stringify({ ok: true, mode: "PREPARE_ONLY" }));
    return;
  }
  if (req.method !== "POST" || req.url !== "/jobs") {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 100_000) throw new Error("Payload too large");
    }
    const job = JSON.parse(raw);
    if (
      job.mode !== "PREPARE_ONLY" ||
      !["inspect", "prepare"].includes(job.action)
    ) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: "Unsafe job rejected" }));
      return;
    }
    if (!allowed(job.url)) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({ error: "A public HTTPS application URL is required" }),
      );
      return;
    }
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
      });
      await page.goto(job.url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      const fields = await page
        .locator("input, textarea, select")
        .evaluateAll((els) =>
          els.slice(0, 150).map((el) => {
            const field = el as HTMLInputElement;
            return {
              tag: field.tagName.toLowerCase(),
              type: field.type || null,
              name: field.name || null,
              label:
                field.labels?.[0]?.innerText?.trim() ||
                field.getAttribute("aria-label") ||
                field.placeholder ||
                null,
              required: Boolean(field.required),
            };
          }),
        );
      const text = (await page.locator("body").innerText())
        .slice(0, 30_000)
        .toLowerCase();
      const blockers = [
        "captcha",
        "recaptcha",
        "hcaptcha",
        "multi-factor",
        "two-factor",
        "legal declaration",
        "certify that",
        "j'atteste",
        "je certifie",
      ].filter((x) => text.includes(x));
      const questions = fields
        .filter((f) => f.required && !f.name && !f.label)
        .map(() => ({
          question: "Champ obligatoire non identifié",
          category: "UNKNOWN_FIELD",
        }));
      for (const blocker of blockers)
        questions.push({
          question: `Intervention humaine requise: ${blocker}`,
          category: "HUMAN_VERIFICATION",
        });
      res.end(
        JSON.stringify({
          ok: true,
          state: questions.length ? "PAUSED" : "INSPECTED",
          title: await page.title(),
          finalUrl: page.url(),
          fields,
          questions,
          submitDisabled: true,
          applicationId: job.applicationId,
        }),
      );
    } finally {
      await browser.close();
    }
  } catch (e) {
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Worker error",
      }),
    );
  }
});
server.listen(port, () =>
  console.log(`Worker listening on ${port} in PREPARE_ONLY mode`),
);

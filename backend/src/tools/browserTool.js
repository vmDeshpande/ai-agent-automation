// EXPERIMENTAL

// backend/src/tools/browserTool.js
const puppeteer = require("puppeteer"); // install puppeteer in backend
const DEFAULT_TIMEOUT = 20_000;

/**
 * Launch options: if you run in serverless or docker, tune args/no-sandbox as needed.
 * For production you should run headless: true and ensure Chromium is available.
 */
async function launchBrowser() {
  return puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
    defaultViewport: { width: 1280, height: 800 }
  });
}

/**
 * Take screenshot of url.
 * options: { fullPage: false, selector: null, timeout }
 */
async function screenshot(url, options = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: options.timeout || DEFAULT_TIMEOUT });
    if (options.selector) {
      const el = await page.$(options.selector);
      if (!el) throw new Error("selector_not_found");
      const buffer = await el.screenshot({ type: "png" });
      return { buffer };
    } else {
      const buffer = await page.screenshot({ fullPage: !!options.fullPage });
      return { buffer };
    }
  } finally {
    await page.close();
    await browser.close();
  }
}

/**
 * evaluate(url, script)
 * script is a string of JS that will run in the page context and must return a JSON-serializable value.
 * Example script: "(() => { return document.title; })()"
 */
async function evaluate(url, script, options = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout || DEFAULT_TIMEOUT });
    // be safe: don't allow heavy infinite loops; user scripts should be synchronous/quick
    const result = await page.evaluate(new Function(`return (${script})()`));
    return { result };
  } finally {
    await page.close();
    await browser.close();
  }
}

module.exports = { screenshot, evaluate };

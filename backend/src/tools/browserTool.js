// backend/src/tools/browserTool.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { BASE_DIR } = require('./fileTool');
const mkdirp = require('util').promisify(fs.mkdir);

const DEFAULT_TIMEOUT = 20_000;

function resolveSafePath(filePath) {
  const resolved = path.resolve(BASE_DIR, filePath);
  const relative = path.relative(BASE_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `Access denied: Path traversal detected for browser screenshot path: "${filePath}"`
    );
  }
  return resolved;
}

async function launchBrowser() {
  return puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
  });
}

async function screenshot(url, options = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: options.timeout || DEFAULT_TIMEOUT });
    let screenshotOpts = { fullPage: !!options.fullPage };
    if (options.path) {
      const safePath = resolveSafePath(options.path);
      await mkdirp(path.dirname(safePath), { recursive: true });
      screenshotOpts.path = safePath;
    }

    if (options.selector) {
      const el = await page.$(options.selector);
      if (!el) throw new Error("selector_not_found");
      const buffer = await el.screenshot({ ...screenshotOpts, type: "png" });
      return options.path ? { path: screenshotOpts.path } : { buffer };
    } else {
      const buffer = await page.screenshot({ ...screenshotOpts, type: "png" });
      return options.path ? { path: screenshotOpts.path } : { buffer };
    }
  } finally {
    await page.close();
    await browser.close();
  }
}

async function evaluate(url, script, options = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeout || DEFAULT_TIMEOUT,
    });
    const result = await page.evaluate((code) => {
      try {
        const fn = new Function(code);
        return fn();
      } catch (e) {
        return { error: e.message };
      }
    }, script);
    return { result };
  } finally {
    await page.close();
    await browser.close();
  }
}

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  const targetFunction = (step.action || "screenshot").toLowerCase();
  const url = step.url || "";

  if (targetFunction === "screenshot") {
    const relativeOutPath = `screenshot_${context.taskId}_${Date.now()}.png`;
    return await screenshot(url, { path: relativeOutPath });
  } else if (targetFunction === "evaluate") {
    const userCode = step.code || 'return document.title;';
    return await evaluate(url, userCode);
  } else {
    throw new Error(`Unsupported browser action matrix descriptor: [${targetFunction}]`);
  }
}

module.exports = {
  meta: {
    id: "browser",
    name: "Browser Automation",
    version: "1.0.0",
    category: "Web",
    description: "Control a headless browser to take screenshots or evaluate JavaScript.",
    fields: [
      { name: "action", label: "Action", type: "select", options: ["screenshot", "evaluate"], default: "screenshot", required: true },
      { name: "url", label: "URL", type: "text", required: true },
      { name: "code", label: "JavaScript Code (for evaluate)", type: "textarea" }
    ]
  },
  screenshot, evaluate, run
};
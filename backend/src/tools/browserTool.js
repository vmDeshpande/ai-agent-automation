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

/**
 * Launch options: if you run in serverless or docker, tune args/no-sandbox as needed.
 */
async function launchBrowser() {
  return puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
    defaultViewport: { width: 1280, height: 800 },
  });
}

/**
 * Take screenshot of url.
 * options: { fullPage: false, selector: null, timeout, path }
 */
async function screenshot(url, options = {}) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: options.timeout || DEFAULT_TIMEOUT,
    });

    const screenshotOpts = { fullPage: !!options.fullPage };
    if (options.path) {
      const safePath = resolveSafePath(options.path);
      // Ensure the destination folder exists
      await mkdirp(path.dirname(safePath), { recursive: true });
      screenshotOpts.path = safePath;
    }

    if (options.selector) {
      const el = await page.$(options.selector);
      if (!el) throw new Error('selector_not_found');

      const buffer = await el.screenshot({ ...screenshotOpts, type: 'png' });
      if (options.path) {
        return { path: screenshotOpts.path };
      }
      return { buffer };
    } else {
      const buffer = await page.screenshot({ ...screenshotOpts, type: 'png' });
      if (options.path) {
        return { path: screenshotOpts.path };
      }
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
 */
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

module.exports = { screenshot, evaluate };

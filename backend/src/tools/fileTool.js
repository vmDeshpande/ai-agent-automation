// backend/src/tools/fileTool.js
// simple file read/write in a safe folder. Beware: do not use for storing secrets.
// Provides readFile, writeFile, deleteFile, listFiles
const fs = require("fs");
const path = require("path");
const util = require("util");
const mkdirp = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const BASE_DIR = path.resolve(process.env.FILE_BASE_DIR || path.join(process.cwd(), "uploads"));

// Ensure BASE_DIR exists
async function ensureBaseDir() {
  try {
    await mkdirp(BASE_DIR, { recursive: true });
  } catch (e) {
    // ignore
  }
}

function sanitizeFilename(name) {
  // very basic sanitization — remove path chars, keep safe chars
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

async function write(filename, content, opts = {}) {
  await ensureBaseDir();
  const safe = sanitizeFilename(filename);
  const full = path.join(BASE_DIR, safe);

  // limit file size (default 5MB)
  const maxBytes = opts.maxBytes || 5 * 1024 * 1024;
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  if (buf.length > maxBytes) throw new Error("file_too_large");

  await writeFile(full, buf);
  return { path: full, filename: safe, size: buf.length };
}

async function read(filename, opts = {}) {
  await ensureBaseDir();
  const safe = sanitizeFilename(filename);
  const full = path.join(BASE_DIR, safe);
  return await readFile(full);
}

async function remove(filename) {
  await ensureBaseDir();
  const safe = sanitizeFilename(filename);
  const full = path.join(BASE_DIR, safe);
  await unlink(full);
  return { removed: safe };
}

async function list() {
  await ensureBaseDir();
  const files = await readdir(BASE_DIR);
  const out = [];
  for (const f of files) {
    const s = await stat(path.join(BASE_DIR, f));
    out.push({ filename: f, size: s.size, mtime: s.mtime });
  }
  return out;
}

module.exports = { write, read, remove, list, BASE_DIR };

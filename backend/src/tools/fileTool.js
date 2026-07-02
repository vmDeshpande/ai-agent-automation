// backend/src/tools/fileTool.js
const fs = require("fs");
const path = require("path");
const util = require("util");
const mkdirp = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const appendFile = util.promisify(fs.appendFile);
const unlink = util.promisify(fs.unlink);
const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

const BASE_DIR = path.resolve(process.env.FILE_BASE_DIR || path.join(process.cwd(), "runtime/sandbox"));

async function ensureDir(dirPath) {
  try { await mkdirp(dirPath, { recursive: true }); } catch (e) {}
}

function resolveSafePath(filePath) {
  const resolved = path.resolve(BASE_DIR, filePath);
  const relative = path.relative(BASE_DIR, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Access denied: Path traversal detected for path: "${filePath}"`);
  }
  return resolved;
}

async function write(filename, content, opts = {}) {
  const fullPath = resolveSafePath(filename);
  await ensureDir(path.dirname(fullPath));
  const maxBytes = opts.maxBytes || 5 * 1024 * 1024;
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  if (buf.length > maxBytes) throw new Error("File too large");
  await writeFile(fullPath, buf);
  const relative = path.relative(BASE_DIR, fullPath);
  return { path: fullPath, filename: relative, size: buf.length };
}

async function append(filename, content, opts = {}) {
  const fullPath = resolveSafePath(filename);
  await ensureDir(path.dirname(fullPath));
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  await appendFile(fullPath, Buffer.concat([buf, Buffer.from("\n")]));
  const relative = path.relative(BASE_DIR, fullPath);
  return { path: fullPath, filename: relative };
}

async function read(filename, opts = {}) {
  const fullPath = resolveSafePath(filename);
  return await readFile(fullPath, "utf8");
}

async function remove(filename) {
  const fullPath = resolveSafePath(filename);
  await unlink(fullPath);
  const relative = path.relative(BASE_DIR, fullPath);
  return { removed: relative };
}

async function list(subDir = "") {
  const fullPath = resolveSafePath(subDir);
  const files = await readdir(fullPath);
  const out = [];
  for (const f of files) {
    const fileFullPath = path.join(fullPath, f);
    const s = await stat(fileFullPath);
    const relative = path.relative(BASE_DIR, fileFullPath);
    out.push({ filename: relative, size: s.size, mtime: s.mtime, isDirectory: s.isDirectory() });
  }
  return out;
}

/**
 * Standardized Tool Contract Interface Mapping Implementation
 */
async function run(step, context, interpolate) {
  const targetFunction = (step.action || "read").toLowerCase();
  const requestedPath = step.path || `stepName_${step.name}_TaskId_${context.taskId}.txt`;
  const content = step.content || "";

  switch (targetFunction) {
    case "write":
      return await write(requestedPath, content);
    case "append":
      return await append(requestedPath, content);
    case "read":
      return await read(requestedPath);
    case "remove":
      return await remove(requestedPath);
    case "list":
      return await list(requestedPath);
    default:
      throw new Error(`Unsupported file action matrix descriptor: [${targetFunction}]`);
  }
}

module.exports = {
  meta: {
    id: "file",
    name: "File System",
    version: "1.0.0",
    category: "Core",
    description: "Read, write, append, or remove files in the workspace.",
    fields: [
      { name: "action", label: "Action", type: "select", options: ["read", "write", "append", "remove", "list"], default: "read", required: true },
      { name: "path", label: "File Path", type: "text", required: true },
      { name: "content", label: "File Content (for write/append)", type: "textarea" }
    ]
  },
  write, append, read, remove, list, BASE_DIR, run
};
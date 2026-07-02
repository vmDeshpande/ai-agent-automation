// backend/src/tools/testSandbox.js
const { runToolInSandbox } = require("./registry");
const path = require("path");
const fs = require("fs");

async function runTests() {
  console.log("🚀 Starting Sandboxed Tool Isolation Tests under Standardized Contract...\n");
  let passed = 0;
  let failed = 0;

  async function assert(name, fn) {
    try {
      await fn();
      console.log(`✅ Test PASSED: ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ Test FAILED: ${name}`);
      console.error(e.message);
      failed++;
    }
  }

  // 1. Test Writing a File Safely
  await assert("Write file via sandbox fileTool", async () => {
    const testFile = "runtime/test_sandbox_file.txt";
    const content = "Hello from the sandbox worker process!";
    const res = await runToolInSandbox("fileTool", "write", [testFile, content]);
    
    if (!res.path.includes("test_sandbox_file.txt")) {
      throw new Error(`Invalid output path in result: ${JSON.stringify(res)}`);
    }
    
    const realContent = fs.readFileSync(res.path, "utf8");
    if (realContent !== content) {
      throw new Error(`File contents mismatch. Expected: "${content}", got: "${realContent}"`);
    }
  });

  // 2. Test Reading the Written File Safely
  await assert("Read file via sandbox fileTool", async () => {
    const testFile = "runtime/test_sandbox_file.txt";
    const res = await runToolInSandbox("fileTool", "read", [testFile]);
    if (res !== "Hello from the sandbox worker process!") {
      throw new Error(`File read mismatch: "${res}"`);
    }
  });

  // 3. Test Appending to File
  await assert("Append file via sandbox fileTool", async () => {
    const testFile = "runtime/test_sandbox_file.txt";
    const appendContent = "Appended line!";
    const res = await runToolInSandbox("fileTool", "append", [testFile, appendContent]);
    
    const realContent = fs.readFileSync(res.path, "utf8");
    const expected = "Hello from the sandbox worker process!Appended line!\n";
    if (realContent !== expected) {
      throw new Error(`File contents mismatch after append. Expected: "${expected}", got: "${realContent}"`);
    }
  });

  // 4. Test Directory Traversal Prevention (Upward Traversal)
  await assert("Block upward directory traversal attempts", async () => {
    try {
      await runToolInSandbox("fileTool", "write", ["../../traversal_test.txt", "evil content"]);
      throw new Error("Sandbox allowed writing outside sandbox root!");
    } catch (e) {
      if (!e.message.includes("Path traversal detected") && !e.message.includes("Access denied")) {
        throw new Error(`Expected path traversal prevention error, but got: "${e.message}"`);
      }
    }
  });

  // 5. Test Directory Traversal Prevention (Absolute Path Traversal)
  await assert("Block absolute path traversal attempts", async () => {
    try {
      await runToolInSandbox("fileTool", "read", ["/etc/passwd"]);
      throw new Error("Sandbox allowed reading an absolute system path!");
    } catch (e) {
      if (!e.message.includes("Path traversal detected") && !e.message.includes("Access denied")) {
        throw new Error(`Expected path traversal prevention error, but got: "${e.message}"`);
      }
    }
  });

  // 6. Test Browser Evaluation inside Sandbox
  await assert("Browser evaluate execution", async () => {
    const res = await runToolInSandbox("browserTool", "evaluate", [
      "https://example.com",
      "return document.title;"
    ]);
    if (res.result !== "Example Domain") {
      throw new Error(`Browser evaluate mismatch: expected "Example Domain", got "${res.result}"`);
    }
  });

  // 7. Test Sandbox Timeout Guard
  await assert("Hanging tool is terminated by the sandbox timeout guard", async () => {
    process.env.TOOL_EXECUTION_TIMEOUT_MS = "1500";
    
    const start = Date.now();
    try {
      await runToolInSandbox("browserTool", "evaluate", [
        "https://example.com",
        "return new Promise(resolve => setTimeout(() => resolve('done'), 5000));"
      ]);
      throw new Error("Hanging tool was not terminated!");
    } catch (e) {
      const elapsed = Date.now() - start;
      if (!e.message.includes("timed out")) {
        throw new Error(`Expected timeout error, but got: "${e.message}"`);
      }
      if (elapsed > 4000) {
        throw new Error(`Timeout took too long to trigger: ${elapsed}ms`);
      }
    } finally {
      delete process.env.TOOL_EXECUTION_TIMEOUT_MS;
    }
  });

  try {
    const testFilePath = path.join(process.cwd(), "runtime/sandbox/runtime/test_sandbox_file.txt");
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  } catch (e) {}

  console.log(`\n📊 Test Execution Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
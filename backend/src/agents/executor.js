// backend/src/agents/executor.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { runLLM } = require("./llmAdapter");
require("dotenv").config();

/**
 * executeStep - central step executor
 * step: { type: "llm"|"http"|"email"|"file"|"browser"| ... }
 * context: object with runtime values (task input, workflow metadata, last output etc)
 */
async function executeStep(step, context = {}) {
  const start = Date.now();

  try {
    // ----- LLM -----
    if (step.type === "llm") {
      const prompt = interpolate(step.prompt, context);
      const llmRes = await runLLM(prompt, step.options || {});
      const result = {
        stepId: step.stepId || null,
        type: "llm",
        tool: "llm",
        output: llmRes.text,
        raw: llmRes.raw,
        success: true,
        timestamp: new Date()
      };
      return result;
    }

    // Delay step
    if (step.type === "delay") {
      const sec = Number(
        step.seconds ?? step.delay ?? step.prompt ?? 0
      );


      console.log("⏳ Delay step → sleeping for", sec, "seconds");

      await new Promise(resolve => setTimeout(resolve, sec * 1000));

      return {
        stepId: step.stepId,
        type: "delay",
        tool: "delay",
        output: `Slept for ${sec} seconds`,
        success: true,
        timestamp: new Date(),
      };
    }


    // ----- HTTP -----
    if (step.type === "http") {
      let parsedBody = null;

      if (step.body) {
        const interpolated = interpolate(step.body, context);
        try {
          parsedBody = JSON.parse(interpolated);
        } catch (err) {
          // fallback to raw string if JSON parse fails
          parsedBody = interpolated;
        }
      }

      const response = await axios({
        method: (step.method || "GET").toLowerCase(),
        url: interpolate(step.url || "", context),
        data: parsedBody,
        headers: step.headers || {},
        timeout: step.timeout || 30000,
        validateStatus: () => true,
      });


      return {
        stepId: step.stepId || null,
        type: "http",
        tool: "http",
        output: response.data,
        success: response.status >= 200 && response.status < 300,
        timestamp: new Date()
      };
    }

    // ----- EMAIL (Mailtrap - minimal test) -----
    if (step.type === "email") {
      try {
        const nodemailer = require("nodemailer");

        const transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT),
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
          to: interpolate(step.to, context),
          subject: interpolate(step.subject || "", context),
          text: interpolate(step.text || "", context),
          html: interpolate(step.html || "", context),
        });

        console.log("✅ Mailtrap response:", info);

        return {
          stepId: step.stepId || null,
          type: "email",
          tool: "email",
          output: {
            messageId: info.messageId,
            accepted: info.accepted,
          },
          success: true,
          timestamp: new Date(),
        };
      } catch (err) {
        console.error("❌ Email step failed:", err);

        return {
          stepId: step.stepId || null,
          type: "email",
          tool: "email",
          output: err.message,
          success: false,
          timestamp: new Date(),
        };
      }
    }

    // ----- FILE (read / write / append) -----
    if (step.type === "file") {
      const action = (step.action || "read").toLowerCase();

      function resolveContent() {
        if (!step.content) return "";

        // If content wants full JSON output → handle explicitly
        if (step.content.includes("{{results}}")) {
          return JSON.stringify(
            {
              taskId: context.taskId,
              workflow: context.workflow?.name,
              generatedAt: context.timestampIso,
              steps: context.results || []
            },
            null,
            2
          );
        }

        // Otherwise normal interpolation
        let interpolated = interpolate(step.content, context);

        interpolated = interpolated.replace(
          /\{\{timestamp\}\}/g,
          new Date().toISOString()
        );

        return interpolated;
      }


      const resolvedPath = step.path
        ? interpolate(step.path, context)
        : `runtime/output_${Date.now()}.txt`;

      const outPath = path.resolve(process.cwd(), resolvedPath);

      const dir = path.dirname(outPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      /* ---------- WRITE ---------- */
      if (action === "write") {
        const content = resolveContent();

        fs.writeFileSync(outPath, content, "utf8");

        return {
          stepId: step.stepId || null,
          type: "file",
          tool: "file",
          output: { path: outPath },
          success: true,
          timestamp: new Date()
        };
      }

      /* ---------- APPEND ---------- */
      if (action === "append") {
        const content = resolveContent();

        fs.appendFileSync(outPath, content + "\n", "utf8");

        return {
          stepId: step.stepId || null,
          type: "file",
          tool: "file",
          output: { path: outPath },
          success: true,
          timestamp: new Date()
        };
      }

      /* ---------- READ ---------- */
      if (action === "read") {
        if (!fs.existsSync(outPath)) {
          return {
            stepId: step.stepId || null,
            type: "file",
            tool: "file",
            output: `File not found: ${outPath}`,
            success: false,
            timestamp: new Date()
          };
        }

        const contents = fs.readFileSync(outPath, "utf8");

        return {
          stepId: step.stepId || null,
          type: "file",
          tool: "file",
          output: contents,
          success: true,
          timestamp: new Date()
        };
      }

      /* ---------- UNKNOWN ---------- */
      return {
        stepId: step.stepId || null,
        type: "file",
        tool: "file",
        output: `Unknown file action: ${step.action}`,
        success: false,
        timestamp: new Date()
      };
    }

    // EXPERIMENTAL
    // ----- BROWSER (screenshot / evaluate) - uses puppeteer -----
    if (step.type === "browser") {
      // lazy require puppeteer
      const puppeteer = require("puppeteer");
      const action = (step.action || "screenshot").toLowerCase();
      const url = interpolate(step.url || "", context);

      // Some environments require launch args; make them configurable via env
      const browser = await puppeteer.launch({
        headless: process.env.PUPPETEER_HEADLESS !== "false",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

      if (action === "screenshot") {
        const runtimeDir = path.resolve(process.cwd(), "runtime");
        if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });

        const outName = `screenshot_${Date.now()}.png`;
        const outPath = path.join(runtimeDir, outName);
        await page.screenshot({ path: outPath, fullPage: true });
        await browser.close();

        return {
          stepId: step.stepId || null,
          type: "browser",
          tool: "browser",
          output: { path: outPath },
          success: true,
          timestamp: new Date()
        };
      }

      if (action === "evaluate") {
        const code = step.code || step.script || "return document.title;";
        const evaluation = await page.evaluate(code => {
          try {
            return eval(code);
          } catch (e) {
            return { error: e.message };
          }
        }, code);

        await browser.close();

        return {
          stepId: step.stepId || null,
          type: "browser",
          tool: "browser",
          output: evaluation,
          success: true,
          timestamp: new Date()
        };
      }

      await browser.close();
      return {
        stepId: step.stepId || null,
        type: "browser",
        tool: "browser",
        output: `Unknown browser action: ${action}`,
        success: false,
        timestamp: new Date()
      };
    }

    // unknown step type
    return {
      stepId: step.stepId || null,
      type: step.type || "unknown",
      tool: step.tool || "unknown",
      output: `Unknown step type: ${step.type}`,
      success: false,
      timestamp: new Date()
    };
  } catch (err) {
    // return error object (don't leak secrets)
    return {
      stepId: step.stepId || null,
      type: step.type || "unknown",
      tool: step.tool || "unknown",
      output: err.message,
      success: false,
      error: (err && err.stack) ? String(err.stack).slice(0, 2000) : undefined,
      timestamp: new Date()
    };
  } finally {
    // you can log step duration if needed
    // const duration = Date.now() - start;
  }
}

/**
 * Basic template interpolation: {{key}} replaced by context[key]
 */
function interpolate(template = "", context = {}) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const k = key.trim();
    // support nested keys like input.text
    const parts = k.split(".");
    let val = context;
    for (const p of parts) {
      if (val === undefined || val === null) break;
      val = val[p];
    }
    return (val !== undefined && val !== null) ? String(val) : "";
  });
}

module.exports = { executeStep };
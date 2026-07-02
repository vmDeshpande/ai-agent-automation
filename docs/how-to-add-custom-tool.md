# How to Add a Custom Tool

This guide walks you through adding a new custom tool to the AI Agent Automation platform. A **tool** is a sandboxed, backend-only action that an AI agent can invoke as a workflow step.

> **Goal:** A beginner contributor should be able to add a working tool in under 30 minutes by following this guide.

---

## 1. Where to Place Your Tool File

All tools live in:

```
backend/src/tools/
```

Create a new file there, e.g.:

```
backend/src/tools/myTool.js
```

---

## 2. The Tool Interface

A tool is a plain JavaScript module. There is no class or interface to extend. Follow these rules:

- Export one or more **named async functions**
- Each function receives a single `options` object (or individual arguments)
- On success, **return** your result
- On failure, either **throw an Error** (sandbox catches it) or **return `{ error, details }`** for graceful degradation so the agent can recover

```js
// backend/src/tools/myTool.js

async function doSomething(options = {}) {
  const { input } = options;

  if (!input) throw new Error("'input' is required");

  // your logic here

  return { result: "done" };
}

module.exports = { doSomething };
```

---

## 3. Register the Tool

Open `backend/src/tools/index.js` and make **two additions**:

**Step 1 — Add the require at the top:**

```js
const myTool = require("./myTool");
```

**Step 2 — Add the export key:**

```js
module.exports = {
  emailTool,
  fileTool,
  browserTool,
  hackerNewsTool,
  myTool,          // ← add this
};
```

> The export key name (e.g. `myTool`) is the exact `toolName` string you will use when calling `runToolInSandbox`.

---

## 4. Environment Variables

If your tool needs secrets or config (API keys, hostnames, etc.):

**Step 1 — Add them to `backend/.env`:**

```
MY_TOOL_API_KEY=your-key-here
```

**Step 2 — Add them to `backend/.env.example`** (no real values):

```
MY_TOOL_API_KEY=
```

**Step 3 — Whitelist them in `registry.js`:**

Open `backend/src/tools/registry.js`. Find the `TOOL_CONFIG_VARS` array and add your variable:

```js
const TOOL_CONFIG_VARS = [
  "FILE_BASE_DIR",
  "MAIL_HOST",
  // ... existing vars ...
  "MY_TOOL_API_KEY",   // ← add this
];
```

> Variables not in this list will be `undefined` inside the sandbox worker, even if set in `.env`.

---

## 5. Complete Working Example — `emailTool`

The `emailTool` sends emails via SMTP using `nodemailer`. Study it as a reference.

**File:** `backend/src/tools/emailTool.js`

### Inputs

| Parameter     | Type   | Required | Description                         |
| :------------ | :----- | :------- | :---------------------------------- |
| `to`          | String | ✅ Yes   | Recipient email address             |
| `subject`     | String | No       | Email subject (default: no-subject) |
| `text`        | String | No       | Plain text body                     |
| `html`        | String | No       | HTML body                           |
| `attachments` | Array  | No       | Nodemailer attachments array        |

### Output

```json
{
  "messageId": "<abc123@example.com>",
  "envelope": { "from": "no-reply@example.com", "to": ["user@example.com"] },
  "accepted": ["user@example.com"],
  "rejected": [],
  "response": "250 OK"
}
```

### Required env vars (already whitelisted in `TOOL_CONFIG_VARS`)

```
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=your-user
MAIL_PASS=your-password
MAIL_FROM=no-reply@example.com
```

### How to invoke it from a workflow step

```js
const { runToolInSandbox } = require("../tools/registry");

const result = await runToolInSandbox("emailTool", "sendMail", [{
  to: "user@example.com",
  subject: "Hello",
  text: "This is a test email."
}]);
```

---

## 6. How to Test Your Tool Locally

**Step 1 — Start the backend:**

```bash
cd backend
npm run dev
```

**Step 2 — Write a quick test script:**

```js
// backend/test-mytool.js
const { runToolInSandbox } = require("./src/tools/registry");

(async () => {
  try {
    const result = await runToolInSandbox("myTool", "doSomething", [{ input: "hello" }]);
    console.log("Result:", result);
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
```

**Step 3 — Run it:**

```bash
node test-mytool.js
```
---

## 7. Checklist Before Raising a PR

- [ ] Tool file created in `backend/src/tools/`
- [ ] Tool is registered in `backend/src/tools/index.js`
- [ ] Env vars added to both `.env` and `.env.example`
- [ ] Env vars whitelisted in `TOOL_CONFIG_VARS` in `registry.js` (if needed)
- [ ] Tool tested locally via `runToolInSandbox`
- [ ] No secrets committed
// /lib/assistant/offline-responder.ts
import type { AssistantRuntimeContext } from "@/context/assistant-context";

export function offlineRespond(
  message: string,
  context?: AssistantRuntimeContext | null
): string {
  const text = message.toLowerCase();

  const hasWorkflow = !!context?.workflowName;
  const hasStep = !!context?.stepType;

  /* ================= GREETING ================= */
  if (text === "hi" || text === "hello" || text.startsWith("hey")) {
    return `👋 **Hi! I'm your in-app workflow assistant.**

I can help you with:
- **Workflows**
- **Steps**
- **Errors**
- **Configuration**

👉 Click on a workflow or step to give me more context.`;
  }

  /* ================= CREATE WORKFLOW ================= */
  if (
    text.includes("create workflow") ||
    text.includes("new workflow") ||
    text.includes("how to create workflow")
  ) {
    return `### 🛠️ Create a Workflow

1. Go to the **Dashboard**
2. Click **Create Workflow**
3. Give it a name and description
4. Add steps to define what it should do
5. Assign an agent and run it

Once a workflow is open, I can explain it **step by step**.`;
  }

  /* ================= WORKFLOW ================= */
  if (text.includes("workflow")) {
    if (!hasWorkflow) {
      return `I don’t know which workflow you’re referring to yet.

👉 Open a workflow from the dashboard or sidebar so I can explain it in detail.`;
    }

    return `### 📦 Current Workflow

You’re working on **"${context.workflowName}"**.

A workflow is a sequence of steps executed by an agent in order.  
Each step performs an action such as:
- Calling an LLM
- Making an HTTP request
- Running a tool or delay`;
  }

  /* ================= CREATE STEP ================= */
  if (
    text.includes("create step") ||
    text.includes("add step") ||
    text.includes("how to create step")
  ) {
    return `### ➕ Create a Step

1. Open a workflow
2. Go to the **Workflow Builder**
3. Click **Add Step**
4. Choose a step type:
   - LLM
   - HTTP
   - Tool
   - Delay
5. Configure inputs and settings

👉 Click on an existing step if you want help editing or understanding it.`;
  }

  /* ================= STEP ================= */
  if (text.includes("step")) {
    if (!hasStep) {
      return `I don’t have information about a specific step yet.

👉 Click on a step in the workflow pipeline so I can explain:
- What it does
- How to configure it
- Common mistakes`;
    }

    return `### 🔹 Selected Step

You’re looking at a **${context.stepType}** step${
      context.stepName ? ` called **"${context.stepName}"**` : ""
    }.

This step performs a **${context.stepType}** action.

Make sure:
- Inputs are correct
- Outputs are expected
- Required API keys are configured`;
  }

  /* ================= STATUS ================= */
  if (text.includes("status")) {
    if (!context?.status) {
      return `I don’t have the current execution status yet.

👉 Run the workflow or select a recent execution to view its status.`;
    }

    return `### 📊 Execution Status

Current workflow status: **${context.status}**.`;
  }

  /* ================= ERRORS / FAILURES ================= */
  if (text.includes("fail") || text.includes("error")) {
    if (!hasStep) {
      return `### ❌ Debugging a Failure

If something failed, try this:

- Open the workflow
- Click the failed step
- Check execution logs
- Verify agent configuration
- Ensure API keys are set (required for LLM steps)`;
    }

    return `### ❌ Step Failure Checklist

For this step:
- Check execution logs
- Verify input/output format
- Confirm agent configuration
- Ensure required API keys are set`;
  }

  /* ================= LLM / AI ================= */
  if (text.includes("llm") || text.includes("ai")) {
    if (!hasStep) {
      return `### 🤖 LLM Steps

LLM steps require:
- A valid API key
- A prompt
- A selected model

👉 Click on an **LLM step** to see its configuration.`;
    }

    if (context.stepType !== "LLM") {
      return `The selected step is **not** an LLM step.

👉 Select an LLM step if you want help with prompts or model configuration.`;
    }

    return `### 🤖 LLM Step Details

This is an **LLM step**.

Requirements:
- Valid API key
- Prompt text
- Configured model

Without an API key, the assistant stays in **offline mode**.`;
  }

  /* ================= DEFAULT ================= */
  return `I’m currently running in **offline mode**.

I can help you with:
- Creating workflows
- Adding steps
- Debugging errors
- Understanding configuration

👉 Click on a workflow or step to give me more context.  
Configure an LLM API key to unlock **AI-powered assistance**.`;
}

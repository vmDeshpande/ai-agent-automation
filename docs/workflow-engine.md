# Workflow Engine

## Workflow Execution Lifecycle

The lifecycle of a workflow run transitions through several distinct phases:
1. **Initialization:** The workflow definition is loaded and validated.
2. **Task Creation:** A unique Task record is created in the database to track execution state.
3. **Execution:** The engine processes each node sequentially or based on routing logic.
4. **Completion:** The final state (Success/Failure) is recorded, and outputs are finalized.

## Graph-Based Execution Model

Workflows operate on a directed graph model. Each step represents a node, and the connections dictate the path. The engine evaluates the graph to determine the next executable node based on the success or conditional logic of the preceding node.

## Step Execution Flow

For every individual step within the graph, the engine follows a strict execution flow:
* **Input Resolution:** Any template variables in the step configuration are resolved using the current run context.
* **Invocation:** The specific handler (LLM, HTTP, Tool, etc.) is invoked with the resolved inputs.
* **Output Capture:** The raw output is captured and appended to the execution context.
* **State Update:** The task log is updated with the step's latency, status, and output.

## Context Propagation

Data flows seamlessly between steps using a built-in templating system.

* `{{last.output}}`: Automatically injects the output string of the immediately preceding step.
* `{{results.stepId}}`: Retrieves the full result object of any specific prior step using its unique identifier.

```json
{
  "systemPrompt": "Analyze the following data:",
  "userInput": "{{last.output}}",
  "referenceData": "{{results.fetch_user_data}}"
}
```
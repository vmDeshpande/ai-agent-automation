// backend/src/workflow/migrations.js

function migrateWorkflowSteps(workflow) {
  if (!workflow || !workflow.metadata || !workflow.metadata.steps) return workflow;

  const migratedSteps = workflow.metadata.steps.map(step => {
    // ── Step 1: Resolve legacy generic 'tool' type to its actual sub-type ──
    // Old format: { type: 'tool', tool: 'file', path: '...' }
    // New format: { type: 'file', config: { path: '...' } }
    let resolvedType = step.type;
    if (String(step.type || '').toLowerCase() === 'tool') {
      const subTool = step.config?.tool || step.tool;
      if (subTool) {
        resolvedType = String(subTool).toLowerCase();
      } else {
        // Fallback heuristic: infer actual tool from config keys if the subTool name was lost during a save
        const conf = step.config || step;
        if (conf.path || (conf.action && ['read','write','append','remove','list'].includes(conf.action))) {
          resolvedType = 'file';
        } else if (conf.to || conf.subject) {
          resolvedType = 'email';
        } else if (conf.url || conf.action === 'evaluate') {
          resolvedType = 'browser';
        }
      }
    }

    // ── Step 2: If config already exists and type hasn't changed, keep as-is ──
    if (step.config !== undefined && resolvedType === step.type) {
      return step;
    }

    const newStep = {
      stepId: step.stepId,
      name: step.name,
      type: resolvedType,
      position: step.position,
      config: {}
    };

    // Helper to move a root-level field into config
    const move = (key) => {
      if (step[key] !== undefined) {
        newStep.config[key] = step[key];
      }
    };

    // Start from existing config if present
    if (step.config) {
      Object.assign(newStep.config, step.config);
    }

    // Migrate based on resolved node type
    switch (resolvedType) {
      case "llm":
        move("prompt"); move("useMemory"); move("memoryTopK");
        break;
      case "http":
        move("method"); move("url"); move("body");
        break;
      case "delay":
        move("seconds");
        break;
      case "document_query":
        move("documentId"); move("query"); move("topK");
        break;
      case "mcp":
        move("serverId"); move("toolName"); move("arguments"); move("timeoutMs");
        break;
      case "condition":
        move("conditionType"); move("operator"); move("value"); move("trueTarget"); move("falseTarget");
        break;
      case "switch":
        move("cases"); move("defaultTarget");
        break;
      case "parallel":
        move("failureStrategy");
        break;
      case "join":
        break;
      default: {
        // For all tool types: hoist any non-base root-level fields into config
        const baseProps = ["stepId", "name", "type", "position", "config"];
        for (const [key, val] of Object.entries(step)) {
          if (!baseProps.includes(key)) {
            newStep.config[key] = val;
          }
        }
        break;
      }
    }

    return newStep;
  });

  workflow.metadata.steps = migratedSteps;
  return workflow;
}

module.exports = { migrateWorkflowSteps };

// backend/src/agents/contextManager.js
// Enhanced context management for step output mapping

class WorkflowContext {
  constructor(initialContext = {}) {
    this.steps = {};      // Named step references
    this.workflow = {};   // Workflow-level variables
    this.results = [];    // Backward compatibility
    this.last = null;     // Backward compatibility
    
    // Copy initial context
    Object.assign(this, initialContext);
  }

  registerStep(stepId, alias, data) {
    const stepData = {
      input: data.input || null,
      prompt: data.prompt || null,
      output: data.output || null,
      raw: data.raw || null,
      success: data.success !== false,
      timestamp: data.timestamp || new Date(),
      duration: data.duration || null,
    };
    
    this.steps[stepId] = stepData;
    if (alias && alias !== stepId) {
      this.steps[alias] = stepData;
    }
  }

  setWorkflowVariable(key, value) {
    this.workflow[key] = value;
  }

  getValue(path) {
    const parts = path.split('.');
    let current = this;
    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }
    return current;
  }

  toInterpolationContext() {
    return {
      steps: this.steps,
      workflow: this.workflow,
      results: this.results,
      last: this.last,
    };
  }
}

function interpolate(template, context) {
  if (typeof template !== 'string') return template;
  
  return template.replace(/\{\{(.*?)\}\}/g, (_, path) => {
    const trimmedPath = path.trim();
    const value = context.getValue(trimmedPath);
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  });
}

module.exports = { WorkflowContext, interpolate };
const mongoose = require('mongoose');

const WorkflowVariableSchema = new mongoose.Schema(
  {
    /**
     * Validated name (^[a-zA-Z0-9_]+$). The mongoose `match` keeps bad data
     * out of the database; the controller's own validator is the user-
     * facing surface (`name_required`, `name_invalid`).
     */
    name: { type: String, required: true, trim: true },
    /**
     * `_v_value` is the obfuscated storage — the *plaintext* value goes
     * through the symmetric encryption layer in `workflow.VariableService`
     * before it lands here. The aggregator never decrypts on reads;
     * it surfaces the marker so the frontend can render "Encrypted" /
     * "Hidden". The `/variables` endpoint serves `value: null` for
     * secrets so callers can't accidentally leak them.
     */
    _v_value: { type: String, default: null },
    isSecret: { type: Boolean, default: false },
    /**
     * Set by the controller on each write — used for optimistic
     * concurrency on the overview endpoint and to give the UI a
     * "last updated" stamp.
     */
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WorkflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, default: null }, // optional AI agent
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }], // linked tasks
    status: {
      type: String,
      enum: ['pending', 'running', 'failed', 'completed'],
      default: 'pending',
    },
    errorLog: [
      {
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    metadata: {
      steps: { type: [mongoose.Schema.Types.Mixed], default: [] },
      edges: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    apiSettings: {
      enabled: { type: Boolean, default: false },
      endpointName: { type: String, default: '', index: true },
      authentication: { type: Boolean, default: false },
      rateLimit: { type: Boolean, default: false },
      responseStepId: { type: String, default: '' },
    },
    /**
     * Issue #283 — workflow-level Variables.
     *
     * `variables[]` is the persistent backing store for the
     * "Variables Management" panel on the workflow detail page. Each
     * entry is a `{ name, _v_value, isSecret, updatedAt }` record (see
     * `WorkflowVariableSchema`). The plaintext value never lives in
     * the database; `WorkflowVariables` controller validates input,
     * encrypts secrets, and rounds-trips them through this field. The
     * field is typed as `Mixed` so the schema enforces nothing about
     * contents — `setWorkflowVariables()` is the single source of
     * truth on shape.
     */
    variables: { type: [mongoose.Schema.Types.Mixed], default: [] },
    /**
     * `trigger` records the manual override of the trigger source. The
     * authoritative trigger is still computed by joining Schedule +
     * Webhook records that point to this workflow (covered inside
     * `getWorkflowOverview`), but this field lets a workflow lock to a
     * specific channel (e.g. "manual-only") even when no Schedule /
     * Webhook exists yet. The new controller surfaces both signals so
     * the overview can present a stable UI even while the user is
     * wiring up triggers.
     *
     * Default `manual` matches the pre-existing behaviour where the
     * "Run Now" button on the detail page works for every workflow.
     */
    trigger: {
      type: { type: String, enum: ['manual', 'webhook', 'schedule'], default: 'manual' },
    },
  },
  { timestamps: true, minimize: false }
);

WorkflowSchema.index({ status: 1 });
WorkflowSchema.index({ agentId: 1 });
WorkflowSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.models.Workflow || mongoose.model('Workflow', WorkflowSchema);

/**
 * Export the variable sub-schema so the controller can re-validate
 * variables against the same enforce-the-rules surface without
 * duplicating the field definitions.
 */
module.exports.WorkflowVariableSchema = WorkflowVariableSchema;

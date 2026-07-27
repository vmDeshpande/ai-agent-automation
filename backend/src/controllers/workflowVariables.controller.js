// src/controllers/workflowVariables.controller.js
//
// Issue #283 — Variables CRUD on a workflow.
//
// Endpoints:
//   GET    /api/workflows/:id/variables     — list (secret values masked)
//   PUT    /api/workflows/:id/variables     — full replace of the array
//   DELETE /api/workflows/:id/variables/:name — remove one
//
// The shape stored on the workflow document is:
//   variables: [{ name: string, _v_value: string|null, isSecret: boolean, updatedAt: Date }]
//
// Secrets are stored as the fixed sentinel "__secret__" in `_v_value`
// and always returned to clients as `value: null` so plaintext never
// leaves the database via the API. Real encryption can swap in later
// behind `_v_value` without breaking this contract.

const Workflow = require('../models/workflow.model');

function sendOK(res, payload = {}) {
  return res.json({ ok: true, ...payload });
}
function sendErr(res, code = 500, msg = 'server_error') {
  return res.status(code).json({ ok: false, error: msg });
}

const SECRET_SENTINEL = '__secret__';
const NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function publicShape(v) {
  return {
    name: v.name,
    isSecret: !!v.isSecret,
    value: v.isSecret ? null : (v._v_value ?? null),
    updatedAt: v.updatedAt,
  };
}

function normalizeVariables(input) {
  if (!Array.isArray(input)) {
    return { error: { code: 400, msg: 'variables_must_be_array' } };
  }
  if (input.length > 100) {
    return { error: { code: 400, msg: 'too_many_variables' } };
  }
  const seen = new Set();
  const out = [];
  for (let i = 0; i < input.length; i++) {
    const v = input[i];
    if (!v || typeof v !== 'object') {
      return { error: { code: 400, msg: `variables[${i}].invalid` } };
    }
    if (typeof v.name !== 'string' || !NAME_REGEX.test(v.name)) {
      return { error: { code: 400, msg: `variables[${i}].name_invalid` } };
    }
    if (seen.has(v.name)) {
      return { error: { code: 400, msg: `variables[${i}].name_duplicate` } };
    }
    seen.add(v.name);
    if (v.isSecret === true) {
      out.push({
        name: v.name,
        _v_value: SECRET_SENTINEL,
        isSecret: true,
        updatedAt: new Date(),
      });
    } else if (v.isSecret === false) {
      if (typeof v.value !== 'string') {
        return { error: { code: 400, msg: `variables[${i}].value_required` } };
      }
      if (v.value.length > 4000) {
        return { error: { code: 400, msg: `variables[${i}].value_too_long` } };
      }
      out.push({
        name: v.name,
        _v_value: v.value,
        isSecret: false,
        updatedAt: new Date(),
      });
    } else {
      return { error: { code: 400, msg: `variables[${i}].isSecret_required` } };
    }
  }
  return { value: out };
}

async function loadOwnedWorkflow(req, res) {
  const workflow = await Workflow.findById(req.params.id);
  if (!workflow) return { error: sendErr(res, 404, 'not_found') };
  if (workflow.userId.toString() !== req.user._id.toString()) {
    return { error: sendErr(res, 403, 'forbidden') };
  }
  return { workflow };
}

async function listVariables(req, res) {
  try {
    const owned = await loadOwnedWorkflow(req, res);
    if (owned.error) return owned.error;
    const vars = Array.isArray(owned.workflow.variables) ? owned.workflow.variables : [];
    return sendOK(res, { variables: vars.map(publicShape) });
  } catch (err) {
    console.error('listVariables error', err);
    return sendErr(res);
  }
}

async function replaceVariables(req, res) {
  try {
    const owned = await loadOwnedWorkflow(req, res);
    if (owned.error) return owned.error;
    const { workflow } = owned;
    const normalized = normalizeVariables(req.body && req.body.variables);
    if (normalized.error) {
      return sendErr(res, normalized.error.code, normalized.error.msg);
    }
    workflow.variables = normalized.value;
    workflow.markModified('variables');
    await workflow.save();
    return sendOK(res, { variables: workflow.variables.map(publicShape) });
  } catch (err) {
    console.error('replaceVariables error', err);
    return sendErr(res);
  }
}

async function deleteVariable(req, res) {
  try {
    const owned = await loadOwnedWorkflow(req, res);
    if (owned.error) return owned.error;
    const { workflow } = owned;
    const name = req.params.name;
    const before = Array.isArray(workflow.variables) ? workflow.variables.length : 0;
    workflow.variables = (workflow.variables || []).filter((v) => v.name !== name);
    if (workflow.variables.length === before) {
      return sendErr(res, 404, 'variable_not_found');
    }
    workflow.markModified('variables');
    await workflow.save();
    return sendOK(res, { variables: workflow.variables.map(publicShape) });
  } catch (err) {
    console.error('deleteVariable error', err);
    return sendErr(res);
  }
}

module.exports = { listVariables, replaceVariables, deleteVariable };

// Surface the helpers so the overview controller can compute "what
// variables would this task see?" without duplicating the rule set.
module.exports.__test__ = { normalizeVariables, publicShape, NAME_REGEX, SECRET_SENTINEL };

const fs = require("fs");
const path = require("path");
const Workflow = require("../models/workflow.model");
const { v4: uuidv4 } = require("uuid");
const { normalizeWorkflowMetadata } = require("../utils/workflowMetadata");

const templatesDir = path.join(__dirname, "../templates");

function loadTemplates() {
    const files = fs.readdirSync(templatesDir);
    return files
        .filter((f) => f.endsWith(".json"))
        .map((file) => {
            const content = fs.readFileSync(path.join(templatesDir, file), "utf-8");
            return JSON.parse(content);
        });
}

function validateTemplate(template) {
    const errors = [];
    const warnings = [];

    const steps = template.steps || [];
    const edges = template.edges || [];

    const stepIds = new Set();

    steps.forEach((step, i) => {
        if (!step.stepId) {
            errors.push(`Step at index ${i} is missing stepId`);
        } else {
            if (stepIds.has(step.stepId)) {
                errors.push(`Duplicate stepId: ${step.stepId}`);
            }
            stepIds.add(step.stepId);
        }
    });

    const edgeIds = new Set();
    edges.forEach((edge, i) => {
        if (!edge.id) {
            warnings.push(`Edge at index ${i} is missing id`);
        } else {
            if (edgeIds.has(edge.id)) {
                errors.push(`Duplicate edge id: ${edge.id}`);
            }
            edgeIds.add(edge.id);
        }

        if (!edge.source || !stepIds.has(edge.source)) {
            errors.push(`Edge "${edge.id || i}" has invalid source: ${edge.source}`);
        }
        if (!edge.target || !stepIds.has(edge.target)) {
            errors.push(`Edge "${edge.id || i}" has invalid target: ${edge.target}`);
        }
    });

    steps.forEach((step) => {
        if (step.stepId && !edges.some((e) => e.source === step.stepId || e.target === step.stepId)) {
            if (steps.length > 1) {
                warnings.push(`Step "${step.stepId}" is not connected to any edge`);
            }
        }
    });

    return { errors, warnings, valid: errors.length === 0 };
}

/* GET /api/templates */
async function listTemplates(req, res) {
    try {
        const templates = loadTemplates().map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            icon: t.icon,
            tags: t.tags,
            stepsCount: t.steps.length,
        }));
        res.json({ ok: true, templates });
    } catch (err) {
        console.error("listTemplates error", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}

/* GET /api/templates/:id */
async function getTemplate(req, res) {
    try {
        const templates = loadTemplates();
        const template = templates.find((t) => t.id === req.params.id);
        if (!template) {
            return res.status(404).json({ ok: false, error: "template_not_found" });
        }
        res.json({ ok: true, template });
    } catch (err) {
        console.error("getTemplate error", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}

/* GET /api/templates/:id/validate */
async function validateTemplateRoute(req, res) {
    try {
        const templates = loadTemplates();
        const template = templates.find((t) => t.id === req.params.id);
        if (!template) {
            return res.status(404).json({ ok: false, error: "template_not_found" });
        }
        const result = validateTemplate(template);
        res.json({ ok: true, ...result });
    } catch (err) {
        console.error("validateTemplate error", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
}

/* POST /api/templates/import/:id */
async function importTemplate(req, res) {
    try {
        const templates = loadTemplates();
        const template = templates.find((t) => t.id === req.params.id);

        if (!template) {
            return res.status(404).json({ ok: false, error: "template_not_found" });
        }

        const validation = validateTemplate(template);
        if (!validation.valid) {
            return res.status(400).json({
                ok: false,
                error: "template_validation_failed",
                errors: validation.errors,
            });
        }

        const idMap = {};
        const steps = (template.steps || []).map((step) => {
            const newId = uuidv4();
            idMap[step.stepId] = newId;
            return { ...step, stepId: newId };
        });

        const edges = (template.edges || []).map((edge) => ({
            ...edge,
            source: idMap[edge.source] ?? edge.source,
            target: idMap[edge.target] ?? edge.target,
        }));

        const workflow = await Workflow.create({
            name: template.name,
            description: template.description,
            userId: req.user._id,
            agentId: template.agentId || null,
            metadata: normalizeWorkflowMetadata({ steps, edges }),
        });

        res.json({ ok: true, workflow, warnings: validation.warnings });
    } catch (err) {
        console.error("importTemplate error", err);
        res.status(500).json({ ok: false, error: "template_import_failed" });
    }
}

module.exports = {
    listTemplates,
    getTemplate,
    validateTemplateRoute,
    importTemplate,
};

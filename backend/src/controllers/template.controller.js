const fs = require("fs");
const path = require("path");
const Workflow = require("../models/workflow.model");
const { v4: uuidv4 } = require("uuid");
const { normalizeWorkflowMetadata } = require("../utils/workflowMetadata");

const templatesDir = path.join(__dirname, "../templates");

function loadTemplates() {
    const templatesDir = path.join(__dirname, "../templates");

    const files = fs.readdirSync(templatesDir);

    const templates = files
        .filter((f) => f.endsWith(".json"))
        .map((file) => {
            const content = fs.readFileSync(
                path.join(templatesDir, file),
                "utf-8"
            );
            return JSON.parse(content);
        });

    return templates;
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
            stepsCount: t.steps.length
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

/* POST /api/templates/import/:id */

async function importTemplate(req, res) {
    try {
        const templateId = req.params.id;

        const templates = loadTemplates();

        const template = templates.find((t) => t.id === templateId);

        if (!template) {
            return res.status(404).json({
                ok: false,
                error: "template_not_found",
            });
        }

        // Generate stepId for every template step
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

        res.json({
            ok: true,
            workflow,
        });
    } catch (err) {
        console.error("importTemplate error", err);

        res.status(500).json({
            ok: false,
            error: "template_import_failed",
        });
    }
}

module.exports = {
    listTemplates,
    getTemplate,
    importTemplate
};
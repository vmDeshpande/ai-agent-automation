// backend/src/controllers/system.controller.js
async function getSystemEnvStatus(req, res) {
    return res.json({
        ok: true,
        env: {
            groq: Boolean(process.env.GROQ_API_KEY),
            openai: Boolean(process.env.OPENAI_API_KEY),
            gemini: Boolean(process.env.GEMINI_API_KEY),
            hf: Boolean(process.env.HF_API_KEY),
        },
    });
}

let workerCacheVersion = Date.now();

function bumpWorkerSettingsVersion() {
    workerCacheVersion = Date.now();
}

function getWorkerSettingsVersion() {
    return workerCacheVersion;
}

module.exports = {
    getSystemEnvStatus, 
    bumpWorkerSettingsVersion,
    getWorkerSettingsVersion,
};

const axios = require("axios");

function getWebhook() {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url) throw new Error("DISCORD_WEBHOOK_URL is not set");
    return url;
}

async function runDiscord(step, context, interpolate) {
    const action = step.action;

    if (action === "send_message") {
        const content = interpolate(step.content || "", context);
        const webhookUrl = getWebhook();
        await axios.post(webhookUrl, {content});

        return {
        sent: true,
        content,
        };
    }

    throw new Error(`Unknown Discord action: ${action}`);
}

module.exports = {runDiscord};
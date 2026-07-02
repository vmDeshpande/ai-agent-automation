const axios = require("axios");

function getWebhook() {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) throw new Error("SLACK_WEBHOOK_URL is not set");
    return url;
    }

    async function runSlack(step, context, interpolate) {
    const action = step.action;

    if (action === "send_message") {
        const text = interpolate(step.text || "", context);
        const webhookUrl = getWebhook();
        await axios.post(webhookUrl, {text});

        return {
        sent: true,
        text,
        };
    }

    throw new Error(`Unknown Slack action: ${action}`);
}

module.exports = {runSlack};
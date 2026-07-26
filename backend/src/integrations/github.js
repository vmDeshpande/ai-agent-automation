const axios = require("axios");

function getToken() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN is not set");
    return token;
}

async function runGitHub(step, context, interpolate) {
    const action = step.action;
    const token = getToken();

    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    };

    if (action === "create_issue") {
        const owner = interpolate(step.owner || "", context);
        const repo = interpolate(step.repo || "", context);
        const title = interpolate(step.title || "", context);
        const body = interpolate(step.body || "", context);

        if (!owner || !repo || !title) throw new Error("create_issue requires owner, repo, and title");

        const res = await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        {title, body},
        {headers}
        ).catch(err => {
            throw new Error(err.response?.data?.message || err.message);
        });

        return {
        issueNumber: res.data.number,
        url: res.data.html_url,
        title: res.data.title,
        state: res.data.state,
        };
    }

    if (action === "get_issue") {
        const owner = interpolate(step.owner || "", context);
        const repo = interpolate(step.repo || "", context);
        const number = interpolate(String(step.issue_number || ""), context);

        if (!owner || !repo || !number) throw new Error("get_issue requires owner, repo, and issue_number");

        const res = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/issues/${number}`,
        {headers}
        ).catch(err => {
            throw new Error(err.response?.data?.message || err.message);
        });

        return {
        issueNumber: res.data.number,
        title: res.data.title,
        body: res.data.body,
        state: res.data.state,
        url: res.data.html_url,
        };
    }

    if (action === "comment_issue" || action === "add_comment") {

        const owner = interpolate(step.owner || "", context);
        const repo = interpolate(step.repo || "", context);
        const number = interpolate(String(step.issue_number || ""), context);
        const comment = interpolate(step.comment || "", context);

        if (!owner || !repo || !number || !comment) throw new Error("comment_issue requires owner, repo, issue_number, and comment");

        const res = await axios.post(
        `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`,
        
        { body: comment },
        {headers}
        ).catch(err => {
            throw new Error(err.response?.data?.message || err.message);
        });

        return {
        commentId: res.data.id,
        url: res.data.html_url,
        body: res.data.body,
        };
    }

    throw new Error(`Unknown GitHub action: ${action}`);
}

module.exports = {runGitHub};
# Telemetry

AI Agent Automation includes a privacy-preserving telemetry system designed for self-hosted deployments.

## What is collected

Telemetry is intentionally minimal and anonymous. The system only collects:

- `instanceId` — a randomly generated UUID stored locally
- `version` — the current application version
- `platform` — operating system / architecture pair
- `features` — high-level availability flags for supported capabilities
- a lightweight heartbeat timestamp when opt-in telemetry is enabled

## What is NOT collected

This system never collects:

- prompts or natural language inputs
- workflow definitions or step content
- user identities or login state
- API keys or secret values
- document uploads or memory contents
- execution logs or raw results

## Opt-in and local-first philosophy

Telemetry is disabled by default. The platform is local-first and self-hosted, so no data is sent outside your deployment unless telemetry is explicitly enabled.

Outbound telemetry requests are also blocked when either of these environment variables is set:

- `TELEMETRY_ENABLED=false`
- `DISABLE_ALL_ANALYTICS=true`

If you want to send heartbeat data to a central endpoint, configure `TELEMETRY_ENDPOINT` in your environment. Otherwise telemetry remains local-only.

If you are using a dedicated telemetry collector site, only set `TELEMETRY_ENDPOINT` in your deployment environment. If `TELEMETRY_ENABLED` is true and `TELEMETRY_ENDPOINT` is configured, the deployment will send heartbeat data to the collector.

## How it works

1. On first startup, the system generates an anonymous `instanceId` and persists it in MongoDB.
2. The deployment stores local analytics counts in MongoDB, such as task executions and step type usage.
3. If telemetry is enabled and a remote endpoint is configured, the backend sends a lightweight heartbeat at most once every 24 hours.
4. The heartbeat contains only anonymized metadata and does not include any private payload.

## Dedicated collector website

If you want to host a separate telemetry collector, deploy the `telematry-website` folder as an independent service. Configure your AI Agent Automation deployment with:

- `TELEMETRY_ENDPOINT` set to the collector service URL (for example `https://collector.example.com/collector`)

The collector site accepts telemetry from enabled deployments, and its dashboard is protected by a separate admin login.

## Viewing tracked data

On the Settings page, there is now a Telemetry section showing:

- whether anonymous telemetry is enabled
- the anonymous instance ID
- whether telemetry is blocked by environment flags
- the last heartbeat timestamp
- local analytics counts stored locally in the deployment

These metrics are stored in MongoDB and displayed inside the UI, so you can inspect them without relying on an external analytics service.

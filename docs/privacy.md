# Privacy Policy

Last updated: June 15, 2026

This policy explains AI Agent Automation's default data handling behavior and the privacy considerations operators should review before running a deployment.

## Scope and self-hosted operation

- AI Agent Automation is designed as a local-first, self-hosted workflow platform. The organization or individual operating a deployment controls its database, environment variables, integrations, and retention practices.
- This policy describes the default project behavior. Operators may need to publish their own deployment-specific privacy notice if they expose the platform to other users or connect additional third-party services.

## Information the platform stores

- Account information such as name, email address, password hash, role, and authentication metadata used for login and access control.
- Workflow, task, schedule, webhook, template, settings, agent, memory, log, and version-history records stored in MongoDB so automations can be created, executed, audited, and restored.
- Documents uploaded for document intelligence, plus extracted chunks and embeddings used for retrieval-augmented generation.
- Execution inputs, outputs, errors, browser automation artifacts, generated files, and operational logs when workflows are run.

## How information is used

- To authenticate users, enforce authorization, and protect authenticated routes.
- To build, run, schedule, debug, export, clone, and version workflows and tasks.
- To power optional assistant, semantic memory, document chat, email, browser, HTTP, webhook, and analytics features configured by the deployment operator.
- To troubleshoot failures, improve reliability, rate-limit sensitive endpoints, and maintain service security.

## Third-party services and integrations

- LLM and embedding prompts may be sent to the provider selected in settings or workflow configuration, including OpenAI, Gemini, Groq, Hugging Face, Ollama, or other configured compatible endpoints.
- HTTP, webhook, browser, and email workflow steps can send user-provided payloads to external URLs, websites, SMTP servers, or APIs chosen by the operator or workflow author.
- The frontend includes Vercel Analytics. Deployments that enable or host this integration should review Vercel's analytics privacy terms and disclose it to their users.
- Anonymous backend telemetry is documented in [`docs/telemetry.md`](telemetry.md) and is disabled by default unless an operator explicitly enables a telemetry endpoint.

## Legal bases and compliance considerations

- For GDPR or similar laws, processing may rely on the operator's legitimate interests in operating the service, contractual necessity for providing the platform, consent where required, or legal obligations.
- For CCPA/CPRA or similar laws, the project does not sell personal information by default. Operators should evaluate whether their own deployment, analytics configuration, or integrations constitute sharing under applicable law.
- Because deployments are self-hosted, the deployment operator is responsible for determining applicable laws, honoring regional privacy rights, and maintaining any required records, notices, data-processing agreements, or consent flows.

## User rights and request process

- Depending on applicable law, users may request access, correction, export, deletion, restriction, objection, or information about how their personal data is processed.
- In the application, users can delete workflows and uploaded documents where those controls are available. Account-level deletion is not currently exposed as a built-in self-service endpoint, so operators may need to handle those requests administratively in MongoDB.
- For project-level privacy questions, open a GitHub Issue or Discussion in the official repository. For requests containing sensitive personal information, contact the maintainer through a private channel listed on the maintainer's GitHub profile or follow the process in [`SECURITY.md`](../SECURITY.md) instead of posting sensitive data publicly.

## Retention and deletion

- Records are retained for as long as needed to operate the deployment, preserve workflow history, troubleshoot failures, comply with legal obligations, and maintain security.
- Deleting a workflow or document removes the records handled by the corresponding application endpoints, including document chunks for deleted documents.
- Operators should define deployment-specific retention schedules for accounts, logs, task history, telemetry records, generated files, backups, and external provider logs.

## Security

- Passwords are hashed before storage, authenticated API routes require JWT-based authorization, and secrets are expected to be supplied through environment variables rather than source code.
- Users should avoid placing unnecessary secrets, regulated data, or highly sensitive personal information in prompts, workflow logs, uploaded documents, generated files, webhook payloads, or third-party integrations.
- Security vulnerabilities should be reported using the process in [`SECURITY.md`](../SECURITY.md) so maintainers can review them responsibly.

## Privacy contact

For non-sensitive privacy questions, use the official GitHub repository's Issues or Discussions. For sensitive privacy or security matters, avoid public posts and contact the maintainer through a private channel listed on their GitHub profile or follow the vulnerability reporting process in [`SECURITY.md`](../SECURITY.md).

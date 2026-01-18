# Security Policy

## Supported Versions

AI Agent Automation is under active development. Security fixes are applied to the latest version on the `main` branch.

| Version        | Supported |
| -------------- | --------- |
| `main`         | ✅ Yes     |
| Older releases | ❌ No      |

If you are running a fork or an older snapshot, please upgrade before reporting issues.

---

## Reporting a Vulnerability

Security issues **must not** be reported via public GitHub issues.

If you discover a potential security vulnerability:

1. **Do not disclose it publicly**
2. Contact the project maintainer directly

   * Via the email listed on the maintainer’s GitHub profile
   * Or via a private message if a secure channel is provided

Please include:

* A clear description of the issue
* Steps to reproduce (if applicable)
* Potential impact
* Any suggested mitigations

All reports will be reviewed promptly and handled responsibly.

---

## Disclosure Process

Once a vulnerability is reported:

1. The maintainer will acknowledge receipt
2. The issue will be investigated privately
3. A fix will be developed and tested
4. A coordinated disclosure will be made if necessary

Security fixes take priority over feature work.

---

## Security Philosophy

AI Agent Automation is designed with the following principles:

* **Local-first execution** — no data leaves your system by default
* **Explicit boundaries** — no hidden network, filesystem, or tool access
* **Deterministic behavior** — predictable execution paths
* **Minimal attack surface** — simple, inspectable architecture

However, **self-hosted software security is a shared responsibility**.

You are responsible for:

* Securing your deployment environment
* Managing secrets safely via environment variables
* Restricting network and filesystem access appropriately

---

## Out of Scope

The following are **not** considered security issues:

* Misconfigurations in user deployments
* Insecure third-party tools or APIs
* Issues caused by running untrusted workflows or prompts

---

Thank you for helping keep this project and its users safe.

> **Security is not a feature — it is a discipline.**

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { Card } from '@/components/ui/card';

const sections = [
  {
    title: 'Scope and self-hosted operation',
    items: [
      'AI Agent Automation is designed as a local-first, self-hosted workflow platform. The organization or individual operating a deployment controls its database, environment variables, integrations, and retention practices.',
      'This policy describes the default project behavior. Operators may need to publish their own deployment-specific privacy notice if they expose the platform to other users or connect additional third-party services.',
    ],
  },
  {
    title: 'Information the platform stores',
    items: [
      'Account information such as name, email address, password hash, role, and authentication metadata used for login and access control.',
      'Workflow, task, schedule, webhook, template, settings, agent, memory, log, and version-history records stored in MongoDB so automations can be created, executed, audited, and restored.',
      'Documents uploaded for document intelligence, plus extracted chunks and embeddings used for retrieval-augmented generation.',
      'Execution inputs, outputs, errors, browser automation artifacts, generated files, and operational logs when workflows are run.',
    ],
  },
  {
    title: 'How information is used',
    items: [
      'To authenticate users, enforce authorization, and protect authenticated routes.',
      'To build, run, schedule, debug, export, clone, and version workflows and tasks.',
      'To power optional assistant, semantic memory, document chat, email, browser, HTTP, webhook, and analytics features configured by the deployment operator.',
      'To troubleshoot failures, improve reliability, rate-limit sensitive endpoints, and maintain service security.',
    ],
  },
  {
    title: 'Third-party services and integrations',
    items: [
      'LLM and embedding prompts may be sent to the provider selected in settings or workflow configuration, including OpenAI, Gemini, Groq, Hugging Face, Ollama, or other configured compatible endpoints.',
      'HTTP, webhook, browser, and email workflow steps can send user-provided payloads to external URLs, websites, SMTP servers, or APIs chosen by the operator or workflow author.',
      'The frontend includes Vercel Analytics. Deployments that enable or host this integration should review Vercel’s analytics privacy terms and disclose it to their users.',
      'Anonymous backend telemetry is documented in docs/telemetry.md and is disabled by default unless an operator explicitly enables a telemetry endpoint.',
    ],
  },
  {
    title: 'Legal bases and compliance considerations',
    items: [
      'For GDPR or similar laws, processing may rely on the operator’s legitimate interests in operating the service, contractual necessity for providing the platform, consent where required, or legal obligations.',
      'For CCPA/CPRA or similar laws, the project does not sell personal information by default. Operators should evaluate whether their own deployment, analytics configuration, or integrations constitute sharing under applicable law.',
      'Because deployments are self-hosted, the deployment operator is responsible for determining applicable laws, honoring regional privacy rights, and maintaining any required records, notices, data-processing agreements, or consent flows.',
    ],
  },
  {
    title: 'User rights and request process',
    items: [
      'Depending on applicable law, users may request access, correction, export, deletion, restriction, objection, or information about how their personal data is processed.',
      'In the application, users can delete workflows and uploaded documents where those controls are available. Account-level deletion is not currently exposed as a built-in self-service endpoint, so operators may need to handle those requests administratively in MongoDB.',
      'For project-level privacy questions, open a GitHub Issue or Discussion in the official repository. For requests containing sensitive personal information, contact the maintainer through a private channel listed on the maintainer’s GitHub profile or follow the process in SECURITY.md instead of posting sensitive data publicly.',
    ],
  },
  {
    title: 'Retention and deletion',
    items: [
      'Records are retained for as long as needed to operate the deployment, preserve workflow history, troubleshoot failures, comply with legal obligations, and maintain security.',
      'Deleting a workflow or document removes the records handled by the corresponding application endpoints, including document chunks for deleted documents.',
      'Operators should define deployment-specific retention schedules for accounts, logs, task history, telemetry records, generated files, backups, and external provider logs.',
    ],
  },
  {
    title: 'Security',
    items: [
      'Passwords are hashed before storage, authenticated API routes require JWT-based authorization, and secrets are expected to be supplied through environment variables rather than source code.',
      'Users should avoid placing unnecessary secrets, regulated data, or highly sensitive personal information in prompts, workflow logs, uploaded documents, generated files, webhook payloads, or third-party integrations.',
      'Security vulnerabilities should be reported using the process in SECURITY.md so maintainers can review them responsibly.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>

        <Card className="mt-6 overflow-hidden shadow-lg">
          <div className="border-b bg-background px-6 py-8 sm:px-10">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              Privacy Policy
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              How AI Agent Automation handles data
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              This policy explains the project&apos;s default data handling behavior and the privacy
              considerations operators should review before running a deployment.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">Last updated: June 15, 2026</p>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-10">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                <ul className="list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="rounded-lg border bg-muted/40 p-5">
              <h2 className="text-xl font-semibold tracking-tight">Privacy contact</h2>
              <p className="mt-2 leading-7 text-muted-foreground">
                For non-sensitive privacy questions, use the official GitHub repository&apos;s
                Issues or Discussions. For sensitive privacy or security matters, avoid public posts
                and contact the maintainer through a private channel listed on their GitHub profile
                or follow the vulnerability reporting process in SECURITY.md.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </main>
  );
}

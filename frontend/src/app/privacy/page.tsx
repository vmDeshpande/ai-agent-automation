import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { Card } from '@/components/ui/card';

const sections = [
  {
    title: 'Information we collect',
    body: 'AI Automation Platform stores account details, workflow definitions, execution history, documents you upload, and settings you configure so the product can authenticate users and run automations.',
  },
  {
    title: 'How we use information',
    body: 'We use collected information to provide workflow execution, display dashboards, troubleshoot failures, improve reliability, and keep the platform secure.',
  },
  {
    title: 'Data sharing',
    body: 'We do not sell personal information. Data is shared only with services required to operate the platform, comply with legal obligations, or protect users and the service.',
  },
  {
    title: 'Security',
    body: 'The platform is designed to keep secrets in environment variables and protect authenticated routes. Users should avoid adding sensitive information to workflow prompts, logs, or documents unless required for their use case.',
  },
  {
    title: 'Data retention',
    body: 'Workflow and account data is retained while an account remains active or as needed for operational, security, and legal purposes. Project administrators can remove data when it is no longer needed.',
  },
  {
    title: 'Your choices',
    body: 'You can update account settings, remove uploaded documents, and delete workflows from the application. For additional privacy requests, contact the project maintainers.',
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
              How AI Automation Platform handles your data
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              This policy explains what information the platform collects, why it is used, and the
              choices available to users. It is intended for contributors, maintainers, and users
              evaluating the project.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">Last updated: June 13, 2026</p>
          </div>

          <div className="space-y-8 px-6 py-8 sm:px-10">
            {sections.map((section) => (
              <section key={section.title} className="space-y-2">
                <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                <p className="leading-7 text-muted-foreground">{section.body}</p>
              </section>
            ))}

            <section className="rounded-lg border bg-muted/40 p-5">
              <h2 className="text-xl font-semibold tracking-tight">Contact</h2>
              <p className="mt-2 leading-7 text-muted-foreground">
                For privacy questions or requests, open a project discussion or contact the
                repository maintainers through the official GitHub repository.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </main>
  );
}

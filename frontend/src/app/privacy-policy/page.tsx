export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>

      <p className="mb-4">
        This Privacy Policy explains how AI Agent Automation collects, processes, stores, and
        protects user data.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Types of Data Collected</h2>
      <ul className="list-disc pl-6">
        <li>User account information</li>
        <li>Workflow definitions and execution history</li>
        <li>Agent memory data</li>
        <li>Uploaded documents and embeddings</li>
        <li>Logs and telemetry (if enabled)</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Purpose of Data Collection</h2>
      <p>
        Data is used to provide automation features, workflow execution, document processing, and
        platform improvements.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Third-Party AI Providers</h2>
      <p>
        When providers such as OpenAI, Gemini, Groq, Hugging Face, or Ollama are configured, prompts
        and related data may be processed according to their respective privacy policies.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Self-Hosted Deployments</h2>
      <p>
        For self-hosted deployments, data remains under the control of the organization or
        individual hosting the platform.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Data Retention</h2>
      <p>
        Data is retained based on deployment configuration and administrator preferences. Users and
        administrators can manage retention according to their operational requirements.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Data Deletion</h2>
      <p>
        Users can remove documents, workflows, memories, and other stored data where supported by
        the platform.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Security Measures</h2>
      <p>
        Reasonable security practices are used to protect stored information from unauthorized
        access.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">User Rights</h2>
      <p>
        Users may request access to, correction of, or deletion of their stored information
        depending on the deployment configuration and applicable laws.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-3">Contact Information</h2>
      <p>
        For privacy-related concerns, please contact the project maintainers through the GitHub
        Issues page.
      </p>
    </main>
  );
}

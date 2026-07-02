'use client';

import { validateGraph } from '@/utils/graphValidation';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { Card } from '@/components/ui/card';
import { AuthGuard } from '@/components/auth/auth-guard';
import { useAssistantContext } from '@/context/assistant-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import VisualBuilder from '@/components/workflow/visual-builder';
import { Textarea } from '@/components/ui/textarea';
import { FieldRenderer } from '@/components/workflow/field-renderer';
import { NodeDefinition } from '@/types/workflow';
import { useEffect } from 'react';
import { Save, Play, Plus, Trash2, AlertTriangle, Download } from 'lucide-react';
import { generateNodeId } from '@/utils/ids'; // ✅ Using centralized ID system
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';

/* ---------------- TYPES ---------------- */

import type {
  StepType,
  ToolType,
  WorkflowNode as WorkflowStep,
  WorkflowPayload as WorkflowResponse,
  WorkflowEdge,
  WorkflowDocument,
  McpTool,
} from '@/types/workflow';
import { BackendStep } from '@/types/workflow';

/* ---------------- UTILS ---------------- */

function getTypeColor(type: string) {
  switch (type.toUpperCase()) {
    case 'LLM':
      return 'bg-primary/20 text-primary border-primary/30';
    case 'HTTP':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'DELAY':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'MCP':
      return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'DOCUMENT':
    case 'DOCUMENT_QUERY':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'CONDITION':
    case 'SWITCH':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'PARALLEL':
    case 'JOIN':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
    default:
      // All dynamically discovered tool nodes get a consistent green badge
      return 'bg-green-500/20 text-green-400 border-green-500/30';
  }
}

/**
 * Schema-driven step summary. Uses nodeDefinitions to find the first non-empty
 * field value as the summary label. Falls back to the type name if nothing is configured.
 */
function summarizeStep(step: WorkflowStep, nodeDefinitions: NodeDefinition[] = []): string {
  const lowerType = (step.type || '').toLowerCase();
  const def = nodeDefinitions.find((d) => d.id.toLowerCase() === lowerType);

  if (def && def.fields.length > 0) {
    const parts: string[] = [];
    for (const field of def.fields) {
      const val = step.config?.[field.name] ?? step[field.name];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const display = String(val).slice(0, 80);
        parts.push(`${field.label}: ${display}${display.length < String(val).length ? '…' : ''}`);
        // Show up to 2 field previews
        if (parts.length >= 2) break;
      }
    }
    return parts.length > 0 ? parts.join(' | ') : `${def.name} — not configured`;
  }

  // Fallback for types not yet in nodeDefinitions
  return `${step.type} step`;
}

export default function WorkflowBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<WorkflowDocument[]>([]);
  const [mcpTools, setMcpTools] = useState<McpTool[]>([]);
  const [nodeDefinitions, setNodeDefinitions] = useState<NodeDefinition[]>([]);
  const [builderMode, setBuilderMode] = useState<'list' | 'visual'>('list');
  const { addToast } = useToast();
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const { setContext, clearContext } = useAssistantContext();
  const [savedStepsSnapshot, setSavedStepsSnapshot] = useState<string>('[]');
  const [savedEdgesSnapshot, setSavedEdgesSnapshot] = useState<string>('[]');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [invalidNodeIds, setInvalidNodeIds] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const hasUnsavedChanges =
    JSON.stringify(steps) !== savedStepsSnapshot || JSON.stringify(edges) !== savedEdgesSnapshot;

  useEffect(() => {
    if (steps.length === 0) {
      setValidationErrors([]);
      setInvalidNodeIds([]);
      return;
    }
    // Pass nodeDefinitions for schema-driven required field validation
    const validation = validateGraph(steps, edges, nodeDefinitions);
    setValidationErrors(validation.errors);
    setInvalidNodeIds(validation.invalidNodeIds);
  }, [steps, edges, nodeDefinitions]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  async function fetchWorkflow() {
    try {
      const res = await fetch(apiUrl(`/workflows/${id}`), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });

      const data = await res.json();
      if (!data.ok) return;

      const workflow: WorkflowResponse = data.workflow;
      setWorkflowName(workflow.name);

      const backendSteps = workflow.metadata?.steps ?? [];
      const backendEdges = (workflow.metadata?.edges ?? []).map((e: any) => {
        let sourceHandle: string | undefined;
        if (e.condition === 'true' || e.condition === 'false') {
          sourceHandle = e.condition;
        } else if (e.caseValue) {
          sourceHandle = e.caseValue;
        }
        return {
          ...e,
          id: e.id || generateNodeId('edge'),
          label: e.label || e.caseValue || e.condition?.toUpperCase() || '',
          animated: true,
          style: { strokeWidth: 2 },
          sourceHandle,
          labelStyle: { fill: 'var(--foreground)', fontSize: 12, fontWeight: 500 },
          labelBgStyle: { fill: 'var(--card)', fillOpacity: 0.9 },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
        };
      });
      setEdges(backendEdges);
      setSavedEdgesSnapshot(JSON.stringify(backendEdges));

      const normalizedSteps: WorkflowStep[] = backendSteps.map((s) => {
        const config = s.config || {};
        const baseProps = ['stepId', 'name', 'type', 'position', 'config'];
        const mergedConfig = { ...config };
        for (const [key, val] of Object.entries(s)) {
          if (!baseProps.includes(key) && val !== undefined && val !== null) {
            mergedConfig[key] = val;
          }
        }

        let legacyType = s.type;
        const lowerType = String(s.type || '').toLowerCase();
        if (lowerType === 'llm') legacyType = 'LLM';
        else if (lowerType === 'http') legacyType = 'HTTP';
        else if (lowerType === 'delay') legacyType = 'Delay';
        else if (lowerType === 'mcp') legacyType = 'MCP';
        else if (lowerType === 'document_query') legacyType = 'Document';
        else if (lowerType === 'condition') legacyType = 'Condition';
        else if (lowerType === 'switch') legacyType = 'Switch';
        else if (lowerType === 'parallel') legacyType = 'Parallel';
        else if (lowerType === 'join') legacyType = 'Join';
        else if (lowerType === 'approval') legacyType = 'Approval';
        else if (lowerType === 'file' || lowerType === 'email' || lowerType === 'browser') legacyType = 'Tool';
        else {
          const matchingDef = nodeDefinitions?.find(d => d.id.toLowerCase() === lowerType);
          if (matchingDef) {
            legacyType = matchingDef.id;
          }
        }

        return {
          ...s,
          id: s.stepId,
          name: s.name,
          type: legacyType,
          position: s.position || { x: 0, y: 0 },
          config: mergedConfig,
        };
      });

      setSteps(normalizedSteps);
      setSavedStepsSnapshot(JSON.stringify(normalizedSteps));
    } catch (err) {
      console.error('Failed to load workflow', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWorkflow();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    setContext({
      page: 'workflow-builder',
      workflowId: id,
      workflowName: workflowName ?? undefined,
      status: 'editing',
      builderSteps: steps.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as any,
        summary: summarizeStep(s, nodeDefinitions),
      })),
    });

    return () => {
      clearContext();
    };
  }, [id, workflowName, steps.length, nodeDefinitions]);

  useEffect(() => {
    async function fetchDocs() {
      try {
        const res = await fetch(apiUrl('/documents'), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });
        const data = await res.json();
        if (data.ok) {
          setDocuments(data.documents || []);
        }
      } catch (err) {
        console.error('Failed to fetch documents', err);
      }
    }
    fetchDocs();
  }, []);

  useEffect(() => {
    async function fetchNodeDefs() {
      try {
        const res = await fetch(apiUrl('/workflows/node-definitions'), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });
        const data = await res.json();
        if (data.ok) {
          setNodeDefinitions(data.nodeDefinitions || []);
        }
      } catch (err) {
        console.error('Failed to fetch node definitions', err);
      }
    }
    fetchNodeDefs();
  }, []);

  useEffect(() => {
    async function fetchMcpTools() {
      try {
        const res = await fetch(apiUrl('/mcp/tools'), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });
        const data = await res.json();
        if (data.ok) {
          setMcpTools(data.tools || []);
        }
      } catch (err) {
        console.error('Failed to fetch MCP tools', err);
      }
    }

    fetchMcpTools();
  }, []);

  function addStep() {
    // Default to the first available node definition (usually 'llm'), or fall back to 'llm'
    const defaultType = nodeDefinitions.length > 0 ? nodeDefinitions[0].id : 'llm';
    const defaultDef = nodeDefinitions[0];
    // Pre-populate default values from the schema
    const defaultConfig: Record<string, any> = {};
    if (defaultDef) {
      for (const field of defaultDef.fields) {
        if (field.default !== undefined) {
          defaultConfig[field.name] = field.default;
        }
      }
    }
    setSteps((prev) => [
      ...prev,
      {
        id: generateNodeId(defaultType),
        type: defaultType,
        name: 'New Step',
        config: defaultConfig,
      },
    ]);
  }

  function enrichStepsWithEdges(steps: WorkflowStep[], edges: WorkflowEdge[]) {
    return steps.map((step) => {
      if (step.type === 'Switch') {
        const outgoing = edges.filter((e) => e.source === step.id);
        const cases = outgoing
          .filter((e) => e.caseValue)
          .map((e) => ({
            value: e.caseValue!,
            target: e.target,
          }));

        return {
          ...step,
          cases,
          defaultTarget: outgoing.find((e) => !e.caseValue)?.target,
        };
      }

      if (step.type === 'Condition') {
        return {
          ...step,
          trueTarget: edges.find((e) => e.source === step.id && e.condition === 'true')?.target,
          falseTarget: edges.find((e) => e.source === step.id && e.condition === 'false')?.target,
        };
      }
      return step;
    });
  }

  async function saveWorkflow(isDraft: boolean = false) {
    try {
      const enrichedSteps = enrichStepsWithEdges(steps, edges);

      const backendSteps = enrichedSteps.map((s) => {
        const lowerType = String(s.type || '').toLowerCase();
        
        const backendStep: any = {
          stepId: s.id,
          name: s.name,
          position: s.position,
          type: lowerType === 'document' ? 'document_query' : lowerType,
          config: s.config || {},
        };

        if (s.config) {
          Object.assign(backendStep, s.config);
        }

        return backendStep;
      });

      const validation = validateGraph(enrichedSteps, edges);
      if (!isDraft && !validation.isValid) {
        console.error('Save workflow blocked due to validation errors:', validation.errors);
        addToast({
          type: 'error',
          title: 'Failed to Save Workflow',
          description:
            validation.errors[0] ||
            'Your workflow contains orphaned edges or invalid connections. Please resolve them before saving.',
        });
        return;
      }

      // 🚀 Topology is verified clean - proceed with secure API request
      const res = await fetch(apiUrl(`/workflows/${id}/steps`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({
          steps: backendSteps,
          edges: edges,
        }),
      });

      if (!res.ok) throw new Error('Failed to save workflow');

      addToast({
        type: 'success',
        title: 'Workflow saved',
        description: 'Your workflow steps were updated successfully',
      });
      setSavedStepsSnapshot(JSON.stringify(steps));
      setSavedEdgesSnapshot(JSON.stringify(edges));
    } catch (err) {
      console.error('Save workflow failed:', err);
      addToast({
        type: 'error',
        title: 'Failed to save workflow',
        description: 'Something went wrong. Try again.',
      });
    }
  }

  function removeStep(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  }

  function updateStep(stepId: string, patch: Partial<WorkflowStep>) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  }

  async function handleExport() {
    try {
      const res = await fetch(apiUrl(`/workflows/${id}/export`), {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workflowName?.replace(/\s+/g, '_') ?? id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      addToast({
        type: 'error',
        title: 'Export failed',
        description: 'Could not export workflow. Try again.',
      });
    }
  }
  async function generateWithAI(regenerate: boolean = false) {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const body: Record<string, unknown> = { description: aiPrompt };
      if (regenerate && steps.length > 0) {
        body.existingGraph = {
          steps: steps.map((s) => ({
            stepId: s.id,
            name: s.name,
            type: String(s.type).toLowerCase() === 'document' ? 'document_query' : String(s.type).toLowerCase(),
            config: s.config || {},
          })),
          edges: edges.map((e) => ({
            source: e.source,
            target: e.target,
            ...(e.condition ? { condition: e.condition } : {}),
            ...(e.caseValue ? { caseValue: e.caseValue } : {}),
          })),
        };
      }
      const res = await fetch(apiUrl('/workflows/generate-ai'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Generation failed');

      const generatedSteps = data.steps.map((s: any) => {
        let finalType = s.type;
        let toolName = s.tool || '';

        const lowerType = String(s.type || '').toLowerCase();
        if (lowerType === 'condition') finalType = 'Condition';
        else if (lowerType === 'switch') finalType = 'Switch';
        else if (['email', 'file', 'browser'].includes(lowerType)) {
          finalType = 'Tool';
          toolName = lowerType;
        } else if (lowerType !== 'tool') {
          const matchingDef = nodeDefinitions.find((d) => d.id.toLowerCase() === lowerType);
          if (matchingDef) finalType = matchingDef.id;
        }

        const config = s.config || {};
        const mergedConfig = { ...config };
        
        for (const [key, val] of Object.entries(s)) {
          if (!['stepId', 'id', 'name', 'type', 'position', 'config'].includes(key) && val !== undefined) {
            mergedConfig[key] = val;
          }
        }

        return {
          ...s,
          ...mergedConfig,
          id: s.stepId || s.id,
          stepId: s.stepId || s.id,
          name: s.name,
          type: finalType,
          ...(toolName ? { tool: toolName } : {}),
          ...(mergedConfig.seconds !== undefined ? { delay: mergedConfig.seconds } : {}),
          position: s.position || { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
          config: mergedConfig,
        };
      });

      const generatedEdges = data.edges.map((e: any) => {
        let sourceHandle: string | undefined;
        if (e.condition === 'true' || e.condition === 'false') sourceHandle = e.condition;
        else if (e.caseValue) sourceHandle = e.caseValue;
        return {
          ...e,
          label: e.label || e.caseValue || (e.condition ? e.condition.toUpperCase() : '') || '',
          animated: true,
          style: { strokeWidth: 2 },
          sourceHandle,
          labelStyle: { fill: 'var(--foreground)', fontSize: 12, fontWeight: 500 },
          labelBgStyle: { fill: 'var(--card)', fillOpacity: 0.9 },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
        };
      });

      setSteps(generatedSteps);
      setEdges(generatedEdges);
      setBuilderMode('visual');
      addToast({ type: 'success', title: 'Workflow generated', description: 'Review the graph and save when ready.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Generation failed', description: err.message || 'Try again.' });
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 pl-64 p-8">
          <p className="opacity-70">Loading workflow builder…</p>
        </main>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AppSidebar />

        <main
          className="flex-1 transition-[padding] duration-300"
          style={{ paddingLeft: 'var(--sidebar-width, 256px)' }}
        >
          <div className="p-8">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Workflow Builder</h1>
                <p className="mt-2 text-muted-foreground">
                  Configure workflow steps and execution order
                </p>
                <p className="text-xs text-muted-foreground mt-1">Workflow ID: {id}</p>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant={builderMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBuilderMode('list')}
                  >
                    Step Builder
                  </Button>

                  <Button
                    variant={builderMode === 'visual' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBuilderMode('visual')}
                  >
                    Visual Graph
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/*Visual Indicator */}
                {hasUnsavedChanges && (
                  <span className="text-sm font-medium text-amber-500 flex items-center gap-2 mr-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    Unsaved Changes
                  </span>
                )}

                <Button variant="outline" onClick={handleExport} disabled={hasUnsavedChanges}>
                  <Download className="mr-2 size-4" />
                  Export JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      if (
                        window.confirm(
                          'You have unsaved changes. Are you sure you want to leave without saving?'
                        )
                      ) {
                        router.push(`/workflows/${id}`);
                      }
                    } else {
                      router.push(`/workflows/${id}`);
                    }
                  }}
                >
                  ← Back to Workflow
                </Button>
                <Button
                  variant="outline"
                  onClick={() => saveWorkflow(true)}
                  disabled={!hasUnsavedChanges}
                >
                  <Save className="mr-2 size-4" />
                  Save Draft
                </Button>
                <Button
                  onClick={() => saveWorkflow(false)}
                  disabled={!hasUnsavedChanges || validationErrors.length > 0}
                >
                  <Play className="mr-2 size-4" />
                  Save Changes
                </Button>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 rounded-lg border border-destructive/50 bg-destructive/10 p-5 text-destructive"
              >
                <h3 className="mb-3 flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-5" />
                  Workflow Validation Errors ({validationErrors.length})
                </h3>
                <ul className="ml-6 list-disc space-y-1.5 text-sm">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
                <p className="mt-4 text-xs font-medium opacity-80">
                  You must resolve these errors before the workflow can be executed.
                </p>
              </motion.div>
            )}
            {/* AI Generation Panel */}
            <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <button
                className="flex w-full items-center justify-between text-sm font-semibold text-primary"
                onClick={() => setAiPanelOpen((v) => !v)}
              >
                <span>✨ Generate with AI</span>
                <span>{aiPanelOpen ? '▲' : '▼'}</span>
              </button>
              {aiPanelOpen && (
                <div className="mt-4 space-y-3">
                  <Textarea
                    placeholder="Describe your workflow in plain English… e.g. When a PDF is uploaded, summarize it and email me the result."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => generateWithAI(false)} disabled={aiLoading || !aiPrompt.trim()}>
                      {aiLoading ? 'Generating…' : 'Generate'}
                    </Button>
                    {steps.length > 0 && (
                      <Button variant="outline" onClick={() => generateWithAI(true)} disabled={aiLoading || !aiPrompt.trim()}>
                        {aiLoading ? 'Updating…' : 'Regenerate / Refine'}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Generated workflow opens in Visual Graph mode. Review and hit Save Changes when ready.
                  </p>
                </div>
              )}
            </div>

            {builderMode === 'visual' && (
              <VisualBuilder
                steps={steps}
                setSteps={setSteps}
                edges={edges}
                onEdgesChange={(updatedEdges) => {
                  setEdges(updatedEdges);
                }}
                onSave={saveWorkflow}
                invalidNodeIds={invalidNodeIds}
                nodeDefinitions={nodeDefinitions}
              />
            )}

            {builderMode === 'list' && (
              <div className="mx-auto max-w-3xl space-y-4">
                <AnimatePresence initial={false}>
                  {steps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      layout
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.98 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <Card
                        className="p-6 transition-shadow hover:shadow-lg"
                        onClick={() => {
                          setContext({
                            page: 'workflow-builder',
                            workflowId: id,
                            workflowName: workflowName ?? undefined,
                            status: 'editing',
                            builderSteps: steps.map((s) => ({
                              id: s.id,
                              name: s.name,
                              type: s.type as any,
                              summary: summarizeStep(s, nodeDefinitions),
                            })),
                            stepId: step.id,
                            stepName: step.name,
                            stepType: step.type as any,
                            stepDescription: summarizeStep(step, nodeDefinitions),
                          });
                        }}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <motion.span
                              layout
                              className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                            >
                              {index + 1}
                            </motion.span>
                            <Badge variant="outline" className={getTypeColor(step.type)}>
                              {step.type}
                            </Badge>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeStep(step.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <Label>Step Type</Label>
                            <Select
                              value={step.type}
                              onValueChange={(v) => {
                                // Pre-populate default values from the new node's schema
                                const newDef = nodeDefinitions.find((d) => d.id === v);
                                const newConfig: Record<string, any> = {};
                                if (newDef) {
                                  for (const field of newDef.fields) {
                                    if (field.default !== undefined) newConfig[field.name] = field.default;
                                  }
                                }
                                updateStep(step.id, { type: v as any, config: newConfig });
                              }}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {nodeDefinitions.map(def => (
                                  <SelectItem key={def.id} value={def.id}>{def.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Step Name</Label>
                            <Input
                              className="mt-1.5"
                              value={step.name}
                              onChange={(e) =>
                                updateStep(step.id, {
                                  name: e.target.value,
                                })
                              }
                            />
                          </div>

                          {(() => {
                            const def = nodeDefinitions.find(d => d.id === step.type || (step.type === 'Tool' && d.id === step.tool));
                            if (!def) return null;
                            return (
                              <div className="mt-4 border-t pt-4 space-y-4">
                                {def.fields.map(field => (
                                  <FieldRenderer
                                    key={field.name}
                                    field={field}
                                    value={step.config?.[field.name]}
                                    onChange={(val) => {
                                      updateStep(step.id, {
                                        config: {
                                          ...(step.config || {}),
                                          [field.name]: val
                                        }
                                      });
                                    }}
                                  />
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>

                <Button variant="outline" className="w-full bg-transparent" onClick={addStep}>
                  <Plus className="mr-2 size-4" />
                  Add Step
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}


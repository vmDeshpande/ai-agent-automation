'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiUrl } from '@/lib/api';
import { Globe, Lock, Check, Copy, Code, AlertCircle, Sliders, ShieldCheck } from 'lucide-react';
import type { WorkflowPayload } from '@/types/workflow';

type ApiSettingsDialogProps = {
  workflow: WorkflowPayload;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveSuccess: () => void;
};

export default function ApiSettingsDialog({
  workflow,
  open,
  onOpenChange,
  onSaveSuccess,
}: ApiSettingsDialogProps) {
  const { addToast } = useToast();

  const [apiEnabled, setApiEnabled] = useState(false);
  const [endpointName, setEndpointName] = useState('');
  const [authentication, setAuthentication] = useState(false);
  const [rateLimit, setRateLimit] = useState(false);
  const [responseStepId, setResponseStepId] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeIntegrationTab, setActiveIntegrationTab] = useState<'curl' | 'javascript' | 'http'>(
    'curl'
  );

  useEffect(() => {
    if (open && workflow) {
      setApiEnabled(workflow.apiSettings?.enabled ?? false);
      setEndpointName(workflow.apiSettings?.endpointName ?? '');
      setAuthentication(workflow.apiSettings?.authentication ?? false);
      setRateLimit(workflow.apiSettings?.rateLimit ?? false);
      setResponseStepId(workflow.apiSettings?.responseStepId ?? '');
      setErrorMessage('');
    }
  }, [open, workflow]);

  const host =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000';
  const backendBaseUrl = host.includes(':3000') ? host.replace(':3000', ':5000') : host;
  const slugPreview = endpointName.trim() || workflow._id;
  const publicApiUrl = `${backendBaseUrl}/api/workflows/public/${slugPreview}`;
  const dockerApiUrl = `http://agentautomation-backend:5000/api/workflows/public/${slugPreview}`;
  const steps = workflow.metadata?.steps ?? [];

  async function handleSave() {
    setSaving(true);
    setErrorMessage('');

    try {
      const trimmedSlug = endpointName.trim();

      if (apiEnabled) {
        if (!trimmedSlug) {
          throw new Error('Endpoint slug is required when API is enabled');
        }
        const slugRegex = /^[a-zA-Z0-9-_]+$/;
        if (!slugRegex.test(trimmedSlug)) {
          throw new Error(
            'Endpoint slug can only contain alphanumeric characters, hyphens, and underscores'
          );
        }
      }

      const res = await fetch(apiUrl(`/workflows/${workflow._id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + localStorage.getItem('token'),
        },
        body: JSON.stringify({
          apiSettings: {
            enabled: apiEnabled,
            endpointName: trimmedSlug,
            authentication,
            rateLimit,
            responseStepId: responseStepId || '',
          },
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to update API settings');
      }

      addToast({
        type: 'success',
        title: 'API Settings Saved',
        description: 'Successfully updated workflow API configurations.',
      });

      onSaveSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setErrorMessage(msg);
      addToast({
        type: 'error',
        title: 'Failed to Save Settings',
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCopy(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }

  const curlCode = [
    `curl -X POST "${publicApiUrl}" \\`,
    `  -H "Content-Type: application/json" \\`,
    authentication ? `  -H "Authorization: Bearer <your_api_key>" \\` : null,
    `  -d '{`,
    `    "question": "How does billing work?"`,
    `  }'`,
  ]
    .filter(Boolean)
    .join('\n');

  const fetchCode = [
    `fetch("${publicApiUrl}", {`,
    `  method: "POST",`,
    `  headers: {`,
    `    "Content-Type": "application/json"${authentication ? ',\n    "Authorization": "Bearer <your_api_key>"' : ''}`,
    `  },`,
    `  body: JSON.stringify({`,
    `    question: "How does billing work?"`,
    `  })`,
    `})`,
    `.then(res => res.json())`,
    `.then(data => console.log(data));`,
  ].join('\n');

  const httpStepCode = [
    `{`,
    `  "method": "POST",`,
    `  "url": "${dockerApiUrl}",`,
    `  "headers": {`,
    `    "Content-Type": "application/json"${authentication ? ',\n    "Authorization": "Bearer <your_api_key>"' : ''}`,
    `  },`,
    `  "body": "{\\n  \\\"question\\\": \\\"{{input.question}}\\\"\\n}"`,
    `}`,
  ].join('\n');

  const activeCode =
    activeIntegrationTab === 'curl'
      ? curlCode
      : activeIntegrationTab === 'javascript'
        ? fetchCode
        : httpStepCode;

  const activeTitle =
    activeIntegrationTab === 'curl'
      ? 'cURL Integration'
      : activeIntegrationTab === 'javascript'
        ? 'JavaScript Fetch'
        : 'HTTP Workflow Integration';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`flex w-[calc(100%-2rem)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-background shadow-2xl transition-[max-width,max-height,opacity,transform] duration-300 ease-out ${
          apiEnabled ? 'max-h-[110vh] max-w-5xl xl:max-w-6xl' : 'max-w-5xl xl:max-w-6xl'
        }`}
      >
        <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-5 sm:px-8">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Globe className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                API Endpoint Settings
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {apiEnabled
                  ? 'Publish this workflow as a callable REST API and configure how it behaves.'
                  : 'Publish this workflow as a REST API when you are ready.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 p-4 sm:p-6 md:p-8">
            {errorMessage && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="rounded-2xl border border-border/70 bg-card/70 shadow-sm">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-semibold text-foreground">
                    Publish as API Endpoint
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Expose this workflow publicly through a REST endpoint.
                  </p>
                </div>
                <Switch checked={apiEnabled} onCheckedChange={setApiEnabled} />
              </div>

              <div
                className={`overflow-hidden border-t border-border/70 px-5 py-5 transition-all duration-300 ease-out ${
                  apiEnabled ? 'max-h-[2600px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
                    <div className="space-y-2">
                      <Label
                        htmlFor="slug"
                        className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                      >
                        Endpoint
                      </Label>
                      <Input
                        id="slug"
                        placeholder="customer-support-agent"
                        value={endpointName}
                        onChange={(e) =>
                          setEndpointName(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                        }
                      />
                      <p className="text-sm text-muted-foreground">
                        Use letters, numbers, hyphens, and underscores only. No spaces.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            Endpoint Preview
                          </span>
                          <Badge
                            variant="outline"
                            className="border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[10px] uppercase text-primary"
                          >
                            POST
                          </Badge>
                        </div>
                        <p className="break-all text-sm text-muted-foreground">{publicApiUrl}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => handleCopy(publicApiUrl, 'url')}
                      >
                        {copiedType === 'url' ? (
                          <Check className="mr-2 size-4 text-success" />
                        ) : (
                          <Copy className="mr-2 size-4" />
                        )}
                        Copy URL
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2 text-sm font-semibold">
                            <Lock className="size-3.5 text-amber-500" />
                            Authentication
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Require a bearer token for secure access.
                          </p>
                        </div>
                        <Switch checked={authentication} onCheckedChange={setAuthentication} />
                      </div>

                      <div className="h-px bg-border/70" />

                      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2 text-sm font-semibold">
                            <Sliders className="size-3.5 text-blue-500" />
                            Rate Limiting
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Throttle excessive requests to keep traffic controlled.
                          </p>
                        </div>
                        <Switch checked={rateLimit} onCheckedChange={setRateLimit} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="flex items-center gap-2 text-sm font-semibold">
                          <ShieldCheck className="size-4 text-success" />
                          Response Mapping
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Choose which step output should be returned from the API response.
                        </p>
                      </div>
                      <Select value={responseStepId} onValueChange={setResponseStepId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Default (Last Executed Step Output)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DEFAULT_STEP_FALLBACK">
                            Default (Last Executed Step Output)
                          </SelectItem>
                          {steps.map((step) => (
                            <SelectItem key={step.stepId} value={step.stepId}>
                              {step.name || step.stepId} ({step.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <Label className="flex items-center gap-2 text-sm font-semibold">
                            <Code className="size-4 text-primary" />
                            Integration
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Copy a ready-to-use example for your preferred integration.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 rounded-full border border-border/70 bg-muted/40 p-1">
                          <Button
                            variant={activeIntegrationTab === 'curl' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveIntegrationTab('curl')}
                          >
                            cURL
                          </Button>
                          <Button
                            variant={activeIntegrationTab === 'javascript' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveIntegrationTab('javascript')}
                          >
                            JavaScript
                          </Button>
                          <Button
                            variant={activeIntegrationTab === 'http' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveIntegrationTab('http')}
                          >
                            HTTP Workflow
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">{activeTitle}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground"
                            onClick={() =>
                              handleCopy(
                                activeIntegrationTab === 'curl'
                                  ? curlCode
                                  : activeIntegrationTab === 'javascript'
                                    ? fetchCode
                                    : httpStepCode,
                                activeIntegrationTab
                              )
                            }
                          >
                            {copiedType === activeIntegrationTab ? (
                              <Check className="size-3.5 text-success" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        </div>
                        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background p-3 text-[11px] leading-relaxed text-foreground selection:bg-primary/20">
                          {activeCode}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="sticky bottom-0 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex justify-end gap-2.5">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

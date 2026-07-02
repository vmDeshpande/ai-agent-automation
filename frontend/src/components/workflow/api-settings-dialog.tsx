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

  // Settings State
  const [apiEnabled, setApiEnabled] = useState(false);
  const [endpointName, setEndpointName] = useState('');
  const [authentication, setAuthentication] = useState(false);
  const [rateLimit, setRateLimit] = useState(false);
  const [responseStepId, setResponseStepId] = useState('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Initialize from workflow
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

  // Generate public endpoint url preview
  const host =
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000';
  // Backend runs on port 5000 typically
  const backendBaseUrl = host.includes(':3000') ? host.replace(':3000', ':5000') : host;
  const slugPreview = endpointName.trim() || workflow._id;
  const publicApiUrl = `${backendBaseUrl}/api/workflows/public/${slugPreview}`;
  const dockerApiUrl = `http://agentautomation-backend:5000/api/workflows/public/${slugPreview}`;

  // Get workflow steps
  const steps = workflow.metadata?.steps ?? [];

  // Save changes
  async function handleSave() {
    setSaving(true);
    setErrorMessage('');

    try {
      const trimmedSlug = endpointName.trim();

      // Client-side validations
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

  // Copy helper
  function handleCopy(text: string, type: string) {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  }

  // Code templates
  const curlCode = `curl -X POST "${publicApiUrl}" \\
  -H "Content-Type: application/json" \\${authentication ? '\n  -H "Authorization: Bearer <your_api_key>" \\' : ''}
  -d '{
    "question": "How does billing work?"
  }'`;

  const fetchCode = `fetch("${publicApiUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"${authentication ? ',\n    "Authorization": "Bearer <your_api_key>"' : ''}
  },
  body: JSON.stringify({
    question: "How does billing work?"
  })
})
.then(res => res.json())
.then(data => console.log(data));`;

  const httpStepCode = `{
  "method": "POST",
  "url": "${dockerApiUrl}",
  "headers": {
    "Content-Type": "application/json"${authentication ? ',\n    "Authorization": "Bearer <your_api_key>"' : ''}
  },
  "body": "{\\n  \\"question\\": \\"{{input.question}}\\"\\n}"
}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl">
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Globe className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                API Endpoint Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Configure settings to publish this workflow as a callable REST API service
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-6 space-y-6">
            {errorMessage && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3.5 text-destructive flex items-start gap-2.5 text-sm">
                <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* General Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Publish as API Endpoint</Label>
                  <p className="text-xs text-muted-foreground">
                    Exposes this workflow at a public HTTP URL
                  </p>
                </div>
                <Switch checked={apiEnabled} onCheckedChange={setApiEnabled} />
              </div>

              {apiEnabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Slug input */}
                  <div className="space-y-2">
                    <Label
                      htmlFor="slug"
                      className="text-xs font-semibold text-muted-foreground uppercase"
                    >
                      Endpoint Slug / Custom Path
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="slug"
                          placeholder="customer-support-agent"
                          value={endpointName}
                          onChange={(e) =>
                            setEndpointName(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                          }
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Letters, numbers, hyphens, and underscores only. No spaces.
                    </p>
                  </div>

                  {/* URL Preview */}
                  <div className="rounded-lg bg-muted/50 border p-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">
                        Public URL Preview
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-primary/5 border-primary/20 text-primary text-[10px] px-1 font-mono"
                      >
                        POST
                      </Badge>
                    </div>
                    <div className="font-mono text-xs break-all text-foreground select-all">
                      {publicApiUrl}
                    </div>
                  </div>

                  {/* Security options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                    <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/10">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Lock className="size-3.5 text-amber-500" />
                          Require Authentication
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Requires Bearer API key header
                        </p>
                      </div>
                      <Switch checked={authentication} onCheckedChange={setAuthentication} />
                    </div>

                    <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/10">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-semibold flex items-center gap-1.5">
                          <Sliders className="size-3.5 text-blue-500" />
                          Rate Limiting
                        </Label>
                        <p className="text-[10px] text-muted-foreground">
                          Throttles excessive requests
                        </p>
                      </div>
                      <Switch checked={rateLimit} onCheckedChange={setRateLimit} />
                    </div>
                  </div>

                  {/* Response Output Mapping */}
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-success" />
                      Response Output Mapping
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Select which step output to return in the HTTP response. If not specified, the
                      API defaults to returning the final executed step&apos;s output.
                    </p>

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

                  {/* Integration Docs */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <Code className="size-4 text-primary" />
                      Integration Instructions
                    </h4>

                    {/* Quickstart Tabs */}
                    <div className="space-y-4">
                      {/* cURL */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-foreground flex items-center gap-1">
                            cURL Integration
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground"
                            onClick={() => handleCopy(curlCode, 'curl')}
                          >
                            {copiedType === 'curl' ? (
                              <Check className="size-3 text-success" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        </div>
                        <pre className="p-3 bg-muted text-[11px] font-mono rounded-lg overflow-x-auto text-foreground border leading-relaxed select-all">
                          {curlCode}
                        </pre>
                      </div>

                      {/* Fetch */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-foreground">
                            JavaScript Fetch
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground"
                            onClick={() => handleCopy(fetchCode, 'fetch')}
                          >
                            {copiedType === 'fetch' ? (
                              <Check className="size-3 text-success" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        </div>
                        <pre className="p-3 bg-muted text-[11px] font-mono rounded-lg overflow-x-auto text-foreground border leading-relaxed select-all">
                          {fetchCode}
                        </pre>
                      </div>

                      {/* HTTP Step */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-foreground flex items-center gap-1">
                            HTTP Step Setup (Calling from other Workflows)
                            <Badge
                              variant="outline"
                              className="text-[9px] scale-90 bg-muted text-muted-foreground border"
                            >
                              Internal Docker
                            </Badge>
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground"
                            onClick={() => handleCopy(httpStepCode, 'httpStep')}
                          >
                            {copiedType === 'httpStep' ? (
                              <Check className="size-3 text-success" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Paste this configuration pattern into an **HTTP Request** step in your
                          parent workflow to call this service programmatically.
                        </p>
                        <pre className="p-3 bg-muted text-[11px] font-mono rounded-lg overflow-x-auto text-foreground border leading-relaxed select-all">
                          {httpStepCode}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-muted/10 flex justify-end gap-2.5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { Bug, LifeBuoy } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type IssueFormValues = {
  type: 'bug' | 'feature' | 'other';
  title: string;
  description: string;
  steps: string;
  expected: string;
  context: string;
};

export function ReportIssueDialog({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);

  const form = useForm<IssueFormValues>({
    defaultValues: {
      type: 'bug',
      title: '',
      description: '',
      steps: '',
      expected: '',
      context: '',
    },
  });

  const issueType = form.watch('type');

  function submitIssue(values: IssueFormValues) {
    const os = navigator.platform;
    const browser = navigator.userAgent;
    const page = window.location.pathname;

    let template = '';
    let body = '';

    if (values.type === 'bug') {
      template = 'bug_report.md';

      body = `
**Describe the bug**
${values.description}

**To Reproduce**
${values.steps}

**Expected behavior**
${values.expected}

**Screenshots**
Attach screenshots after opening the issue.

**Desktop (please complete the following information):**
 - OS: ${os}
 - Browser: ${browser}
 - Page: ${page}

**Smartphone (please complete the following information):**
 - Device: N/A
 - OS: N/A
 - Browser: N/A

**Additional context**
${values.context}
`;
    } else if (values.type === 'feature') {
      template = 'feature_request.md';

      body = `
**Is your feature request related to a problem? Please describe.**
${values.description}

**Describe the solution you'd like**
${values.expected}

**Describe alternatives you've considered**
${values.steps}

**Additional context**
${values.context}

**Environment**
Page: ${page}
Browser: ${browser}
OS: ${os}
`;
    } else {
      body = `
**Description**
${values.description}

**Steps / Details**
${values.steps}

**Additional context**
${values.context}

**Environment**
Page: ${page}
Browser: ${browser}
OS: ${os}
`;
    }

    let url = 'https://github.com/vmDeshpande/ai-agent-automation/issues/new?';

    if (template) {
      url += `template=${template}&`;
    }

    url += 'title=' + encodeURIComponent(values.title) + '&body=' + encodeURIComponent(body);

    window.open(url, '_blank');
    setOpen(false);
  }

  const triggerContent = (
    <button
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary w-full',
        'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border border-transparent'
      )}
      onClick={() => setOpen(true)}
    >
      <div
        className={cn(
          'flex items-center justify-center size-7 rounded-lg shrink-0 transition-colors',
          'text-sidebar-foreground/70 group-hover:bg-background/50 group-hover:text-sidebar-foreground'
        )}
      >
        <LifeBuoy className="size-4" />
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            className="flex-1 whitespace-nowrap text-left"
          >
            Report Issues
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );

  return (
    <>
      {collapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{triggerContent}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={14}>
            Report Issues
          </TooltipContent>
        </Tooltip>
      ) : (
        triggerContent
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              Fill the form below. A GitHub issue will open with the information pre-filled.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(submitIssue)} className="space-y-4">
                {/* TYPE */}

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          <SelectItem value="bug">Bug Report</SelectItem>
                          <SelectItem value="feature">Feature Request</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {/* TITLE */}

                <FormField
                  control={form.control}
                  name="title"
                  rules={{ required: 'Issue title is required' }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Example: Workflow execution fails" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* BUG REPORT FORM */}

                {issueType === 'bug' && (
                  <>
                    <FormField
                      control={form.control}
                      name="description"
                      rules={{ required: 'Description is required' }}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Describe the Bug</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Explain what happened..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="steps"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Steps to Reproduce</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Steps to reproduce..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expected"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Behavior</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              placeholder="What should have happened?"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* FEATURE REQUEST FORM */}

                {issueType === 'feature' && (
                  <>
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Problem Description</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={4}
                              placeholder="What problem are you facing?"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expected"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Proposed Solution</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={4}
                              placeholder="What would you like to see?"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="steps"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alternatives Considered</FormLabel>
                          <FormControl>
                            <Textarea
                              rows={3}
                              placeholder="Any alternatives you've considered?"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* OTHER FORM */}

                {issueType === 'other' && (
                  <>
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea rows={4} placeholder="Describe the issue..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="steps"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Details</FormLabel>
                          <FormControl>
                            <Textarea rows={3} placeholder="Additional details..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* CONTEXT (COMMON) */}

                <FormField
                  control={form.control}
                  name="context"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Context</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Extra information or screenshots"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full shrink-0">
                  Open GitHub Issue
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

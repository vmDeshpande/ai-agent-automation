"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, MoreVertical, Bot } from "lucide-react";

type Agent = {
    _id: string;
    name: string;
};

interface Workflow {
    _id: string;
    name: string;
    description?: string;
    status: "idle" | "running" | "failed" | "completed";
    agentId?: string;
}

function getStatusColor(status: string) {
    switch (status) {
        case "running":
            return "bg-success/20 text-success border-success/30"
        case "idle":
            return "bg-muted text-muted-foreground border-border"
        case "failed":
            return "bg-destructive/20 text-destructive border-destructive/30"
        default:
            return "bg-muted text-muted-foreground"
    }
}

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [agentMap, setAgentMap] = useState<Record<string, string>>({});

    async function fetchAgents() {
        const res = await fetch("http://localhost:5000/api/agents", {
            headers: {
                Authorization: "Bearer " + localStorage.getItem("token"),
            },
        });

        const data = await res.json();
        if (data.ok) {
            setAgents(data.agents);

            // 🔥 build fast lookup map
            const map: Record<string, string> = {};
            data.agents.forEach((a: Agent) => {
                map[a._id] = a.name;
            });

            setAgentMap(map);
        }
    }


    async function fetchWorkflows() {
        try {
            const res = await fetch("http://localhost:5000/api/workflows", {
                headers: {
                    Authorization: "Bearer " + (localStorage.getItem("token") ?? ""),
                },
            });

            const data = await res.json();
            setWorkflows(data.workflows || []);
        } catch (err) {
            console.error("Failed to fetch workflows:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteWorkflow(id: string) {
        const confirmed = confirm("Delete this workflow? This cannot be undone.");
        if (!confirmed) return;

        try {
            const res = await fetch(
                `http://localhost:5000/api/workflows/${id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: "Bearer " + (localStorage.getItem("token") ?? ""),
                    },
                }
            );

            if (!res.ok) {
                alert("Failed to delete workflow");
                return;
            }

            fetchWorkflows();
        } catch (err) {
            console.error("Delete failed:", err);
        }
    }

    useEffect(() => {
        fetchWorkflows();
    }, []);

    useEffect(() => {
        fetchAgents();
    }, []);

    function getAgentName(agentId?: string | null) {
        if (!agentId) return "No agent";
        return agentMap[agentId] ?? "Unknown agent";
    }

    function getStatusBadge(status: Workflow["status"]) {
        switch (status) {
            case "running":
                return "bg-blue-100 text-blue-700";
            case "failed":
                return "bg-red-100 text-red-700";
            case "completed":
                return "bg-green-100 text-green-700";
            default:
                return "bg-gray-100 text-gray-700";
        }
    }

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <AppSidebar />

                <main className="flex-1 pl-64">
                    <div className="p-8">
                        <div className="mb-8 flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold">Workflows</h1>
                                <p className="mt-2 text-muted-foreground">
                                    Manage your AI automation workflows
                                </p>
                            </div>

                            <Button onClick={() => setOpen(true)}>
                                <Plus className="mr-2 size-4" />
                                Create Workflow
                            </Button>
                        </div>

                        {loading ? (
                            <p className="opacity-70">Loading workflows...</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                {workflows.map((workflow) => (
                                    <Card key={workflow._id} className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <Link
                                                    href={`/workflows/${workflow._id}`}
                                                    className="text-lg font-semibold hover:text-primary"
                                                >
                                                    {workflow.name}
                                                </Link>

                                                {workflow.description && (
                                                    <p className="mt-2 text-sm text-muted-foreground">
                                                        {workflow.description}
                                                    </p>
                                                )}
                                            </div>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>

                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() =>
                                                            handleDeleteWorkflow(workflow._id)
                                                        }
                                                    >
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between">
                                            <Badge className={getStatusColor(workflow.status)}>{workflow.status}</Badge>

                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Bot className="size-4" />
                                                <span>{getAgentName(workflow.agentId)}</span>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </main>

                <CreateWorkflowModal
                    open={open}
                    onOpenChange={setOpen}
                    refresh={fetchWorkflows}
                />
            </div>
        </AuthGuard>
    );
}

/* ---------------- Modal ---------------- */

function CreateWorkflowModal({
    open,
    onOpenChange,
    refresh,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    refresh: () => void;
}) {
    const [loading, setLoading] = useState(false);

    async function createWorkflow(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);

        const form = e.currentTarget;
        const name = (form.elements.namedItem("name") as HTMLInputElement).value;
        const description = (
            form.elements.namedItem("description") as HTMLTextAreaElement
        ).value;

        try {
            const res = await fetch("http://localhost:5000/api/workflows", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + (localStorage.getItem("token") ?? ""),
                },
                body: JSON.stringify({ name, description }),
            });

            if (!res.ok) throw new Error("Failed to create workflow");

            refresh();
            form.reset();
            onOpenChange(false);
        } catch (err) {
            console.error("Create workflow failed", err);
            alert("Failed to create workflow");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Create workflow</DialogTitle>
                    <DialogDescription>
                        Create a new automation workflow. You’ll configure agents and steps
                        after creation.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={createWorkflow} className="space-y-6">
                    {/* Workflow name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Workflow name</Label>
                        <Input
                            id="name"
                            name="name"
                            placeholder="e.g. Daily Report Generator"
                            required
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Describe what this workflow does…"
                            className="min-h-[100px]"
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating…" : "Create workflow"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
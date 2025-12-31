"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

type Task = {
    _id: string;
    name: string;
    status: "pending" | "running" | "completed" | "failed";
    createdAt: string;
};

const PAGE_SIZE = 10;

export default function WorkflowTasksPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    async function fetchTasks(pageNumber = 1) {
        setLoading(true);
        try {
            const res = await fetch(
                `http://localhost:5000/api/tasks?workflowId=${id}&page=${pageNumber}&limit=${PAGE_SIZE}`,
                {
                    headers: {
                        Authorization: "Bearer " + localStorage.getItem("token"),
                    },
                }
            );

            const data = await res.json();
            if (data.ok) {
                setTasks(data.tasks);
                setTotalPages(data.meta?.pages || 1);
            }
        } catch (err) {
            console.error("Failed to fetch workflow tasks", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchTasks(page);
    }, [id, page]);

    function statusBadge(status: Task["status"]) {
        switch (status) {
            case "completed":
                return "bg-success/20 text-success border-success/30";
            case "running":
                return "bg-warning/20 text-warning border-warning/30";
            case "failed":
                return "bg-destructive/20 text-destructive border-destructive/30";
            default:
                return "bg-muted text-muted-foreground";
        }
    }

    return (
        <AuthGuard>
        <div className="flex min-h-screen">
            <AppSidebar />
            <main
  className="flex-1 transition-[padding] duration-300"
  style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
>
                <div className="p-8 space-y-6">
                    {/* Header */}
                    <div>
                        <h1 className="text-3xl font-bold">Workflow Task History</h1>
                        <p className="text-muted-foreground mt-1">
                            All executions for this workflow
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => router.push(`/workflows/${id}`)}
                    >
                        ← Back to Workflow
                    </Button>
                    {/* Content */}
                    {loading ? (
                        <p className="opacity-70">Loading tasks…</p>
                    ) : tasks.length === 0 ? (
                        <p className="italic opacity-60">No tasks found.</p>
                    ) : (
                        <div className="space-y-3">
                            {tasks.map((task) => (
                                <Card
                                    key={task._id}
                                    className="p-4 cursor-pointer hover:bg-muted/40 transition"
                                    onClick={() =>
                                        router.push(`/tasks/${task._id}`)
                                    }
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold">{task.name}</h3>
                                            <p className="text-xs opacity-60">
                                                {new Date(task.createdAt).toLocaleString()}
                                            </p>
                                        </div>

                                        <Badge
                                            variant="outline"
                                            className={statusBadge(task.status)}
                                        >
                                            {task.status}
                                        </Badge>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    />
                                </PaginationItem>

                                {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => {
                                    const p = i + 1;
                                    return (
                                        <PaginationItem key={p}>
                                            <PaginationLink
                                                isActive={p === page}
                                                onClick={() => setPage(p)}
                                            >
                                                {p}
                                            </PaginationLink>
                                        </PaginationItem>
                                    );
                                })}

                                {totalPages > 5 && (
                                    <PaginationItem>
                                        <PaginationLink
                                            onClick={() => {
                                                const input = prompt(
                                                    `Go to page (1 - ${totalPages})`
                                                );
                                                const p = Number(input);
                                                if (p >= 1 && p <= totalPages) setPage(p);
                                            }}
                                        >
                                            …
                                        </PaginationLink>
                                    </PaginationItem>
                                )}

                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() =>
                                            setPage((p) => Math.min(totalPages, p + 1))
                                        }
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    )}
                </div>
            </main>
        </div>
        </AuthGuard>
    );
}

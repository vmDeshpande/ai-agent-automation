"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash } from "lucide-react";
import { CronExpressionParser } from "cron-parser";

type Schedule = {
    _id: string;
    workflowName: string;
    cron: string;
    enabled: boolean;
    timezone?: string;
};

type ScheduleTableProps = {
    schedules: Schedule[];
    loading: boolean;
    onChange: () => void;
};

function formatTime(date: Date) {
    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

function formatCountdown(target: Date) {
    const diff = Math.max(0, target.getTime() - Date.now());

    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
        return `in ${minutes}m ${seconds}s`;
    }

    return `in ${seconds}s`;
}

function getNextRun(cron: string): Date | null {
    try {
        const interval = CronExpressionParser.parse(cron, {
            tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });

        return interval.next().toDate();
    } catch {
        return null;
    }
}

function cronToHuman(cron: string) {
    if (cron.startsWith("*/")) {
        const n = cron.split("*/")[1].split(" ")[0];
        return `Every ${n} minute(s)`;
    }
    if (cron.startsWith("0 */")) {
        const n = cron.split("0 */")[1].split(" ")[0];
        return `Every ${n} hour(s)`;
    }
    return "Custom schedule";
}

export default function ScheduleTable({
    schedules,
    loading,
    onChange,
}: ScheduleTableProps) {
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [, forceTick] = useState(0);

    useEffect(() => {
        const t = setInterval(() => forceTick((v) => v + 1), 1000);
        return () => clearInterval(t);
    }, []);

    async function toggle(id: string, enabled: boolean) {
        try {
            setTogglingId(id);
            await fetch(`http://localhost:5000/api/schedules/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + localStorage.getItem("token"),
                },
                body: JSON.stringify({ enabled }),
            });
            onChange();
        } finally {
            setTogglingId(null);
        }
    }

    async function remove(id: string) {
        if (!confirm("Delete this schedule?")) return;
        await fetch(`http://localhost:5000/api/schedules/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: "Bearer " + localStorage.getItem("token"),
            },
        });
        onChange();
    }

    function formatTime(date: Date) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }

    function formatCountdown(target: Date) {
        const diff = Math.max(0, target.getTime() - Date.now());

        const totalSeconds = Math.floor(diff / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes > 0) {
            return `in ${minutes}m ${seconds}s`;
        }

        return `in ${seconds}s`;
    }


    if (loading) {
        return <p className="p-6 text-muted-foreground">Loading schedules…</p>;
    }

    if (!schedules.length) {
        return <p className="p-6 text-muted-foreground">No schedules created.</p>;
    }

    return (
        <table className="w-full text-sm">
            <thead className="border-b">
                <tr className="text-left">
                    <th className="p-3">Workflow</th>
                    <th className="p-3">Next Run</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                </tr>
            </thead>

            <tbody>
                {schedules.map((s) => {

                    return (
                        <tr key={s._id} className="border-b">
                            <td className="p-3 font-medium">{s.workflowName}</td>

                            <td className="p-3">
                                {(() => {
                                    const next = getNextRun(s.cron);
                                    if (!next) {
                                        return <span className="text-xs text-destructive">Invalid cron</span>;
                                    }

                                    return (
                                        <div className="text-xs leading-tight">
                                            <div className="font-mono text-foreground">
                                                {formatTime(next)}
                                            </div>
                                            <div className="text-muted-foreground">
                                                {formatCountdown(next)}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </td>

                            <td className="p-3">
                                <Badge
                                    variant="outline"
                                    className={
                                        s.enabled
                                            ? "border-success text-success bg-success/10"
                                            : "border-muted text-muted-foreground"
                                    }
                                >
                                    {s.enabled ? "Active" : "Paused"}
                                </Badge>
                            </td>

                            <td className="p-3 flex items-center gap-3">
                                <Switch
                                    checked={s.enabled}
                                    disabled={togglingId === s._id}
                                    onCheckedChange={(value) => toggle(s._id, value)}
                                />

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => remove(s._id)}
                                >
                                    <Trash className="size-4" />
                                </Button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

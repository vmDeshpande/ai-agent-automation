"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ScheduleTable from "@/components/schedules/ScheduleTable";
import CreateScheduleDialog from "@/components/schedules/CreateScheduleDialog";

export default function SchedulesPage() {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);

    async function fetchSchedules() {
        const res = await fetch("http://localhost:5000/api/schedules", {
            headers: {
                Authorization: "Bearer " + localStorage.getItem("token"),
            },
            cache: "no-store",
        });

        const data = await res.json();
        if (data.ok) setSchedules(data.schedules);
        setLoading(false);
    }

    useEffect(() => {
        fetchSchedules();
    }, []);

    return (
        <AuthGuard>
            <div className="flex min-h-screen">
                <AppSidebar />

                <main
  className="flex-1 transition-[padding] duration-300"
  style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
>
                    <div className="p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold">Schedules</h1>
                                <p className="text-muted-foreground">
                                    Automatically run workflows on a schedule
                                </p>
                            </div>

                            <CreateScheduleDialog onCreated={fetchSchedules} />
                        </div>

                        <Card>
                            <ScheduleTable
                                schedules={schedules}
                                loading={loading}
                                onChange={fetchSchedules}
                            />
                        </Card>
                    </div>
                </main>
            </div>
        </AuthGuard>
    );
}

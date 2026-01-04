"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ScheduleTable from "@/components/schedules/ScheduleTable";
import CreateScheduleDialog from "@/components/schedules/CreateScheduleDialog";
import { useAssistantContext } from "@/context/assistant-context";

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const { setContext, clearContext } = useAssistantContext();

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

  useEffect(() => {
    if (loading) return;

    setContext({
      page: "schedules",

      status: `${schedules.length} schedule(s) configured`,

      schedules: schedules.map((s: any) => ({
        scheduleId: s._id,
        scheduleName: s.name ?? "Unnamed schedule",
        cron: s.cron ?? "Not set",
        enabled: Boolean(s.enabled),
      })),
    });

    return () => {
      clearContext();
    };
  }, [loading, schedules.length]);

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

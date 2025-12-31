"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type CreateScheduleDialogProps = {
  onCreated: () => void;
};

type Mode = "simple" | "advanced";
type Unit = "minute" | "hour" | "day";

export default function CreateScheduleDialog({
  onCreated,
}: CreateScheduleDialogProps) {
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [workflowId, setWorkflowId] = useState("");

  const [mode, setMode] = useState<Mode>("simple");

  // simple mode
  const [every, setEvery] = useState(1);
  const [unit, setUnit] = useState<Unit>("minute");
  const [time, setTime] = useState("09:00");

  // advanced
  const [cron, setCron] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { addToast } = useToast();

  const generatedCron = useMemo(() => {
    if (mode === "advanced") return cron;

    if (unit === "minute") return `*/${every} * * * *`;
    if (unit === "hour") return `0 */${every} * * *`;

    // day
    const [h, m] = time.split(":");
    return `${m} ${h} */${every} * *`;
  }, [mode, every, unit, time, cron]);

  const humanPreview = useMemo(() => {
    if (mode === "advanced") return "Custom cron schedule";

    if (unit === "minute") return `Every ${every} minute(s)`;
    if (unit === "hour") return `Every ${every} hour(s)`;
    return `Every ${every} day(s) at ${time}`;
  }, [mode, every, unit, time]);

  async function create() {
    if (!name || !workflowId || !generatedCron) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          name,
          workflowId,
          cron: generatedCron,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          taskInput: {},
          taskMetadata: { origin: "ui" },
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to create schedule");

      setOpen(false);
      setName("");
      setWorkflowId("");
      setCron("");
      setEvery(1);
      setUnit("minute");

      onCreated();
      addToast({
        type: "success",
        title: "Schedule Created Successfully",
        description: "Your schedule was created successfully",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create schedule"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Schedule</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Schedule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Schedule Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Workflow ID</Label>
            <Input
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Advanced Cron</Label>
            <Switch
              checked={mode === "advanced"}
              onCheckedChange={(v) => setMode(v ? "advanced" : "simple")}
            />
          </div>

          {mode === "simple" ? (
            <>
              <div className="flex gap-3">
                <Input
                  type="number"
                  min={1}
                  value={every}
                  onChange={(e) => setEvery(Number(e.target.value))}
                />

                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit)}
                >
                  <option value="minute">Minutes</option>
                  <option value="hour">Hours</option>
                  <option value="day">Days</option>
                </select>
              </div>

              {unit === "day" && (
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              )}
            </>
          ) : (
            <div>
              <Label>Cron Expression</Label>
              <Input
                placeholder="*/5 * * * *"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
              />
            </div>
          )}

          <div className="rounded-md bg-muted/40 p-3 text-xs">
            <p className="font-medium">Schedule Preview</p>
            <p>{humanPreview}</p>
            <p className="font-mono opacity-70">Cron: {generatedCron}</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={create} disabled={loading} className="w-full">
            {loading ? "Creating…" : "Create Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

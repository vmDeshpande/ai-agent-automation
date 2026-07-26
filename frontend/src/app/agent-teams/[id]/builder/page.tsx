"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getAgentTeam, updateAgentTeam, createAgentTeam } from "@/lib/api";
import { AgentTeamBuilder } from "@/components/workflow/agent-builder/AgentTeamBuilder";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Save, ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import type { Node, Edge } from "reactflow";

export default function AgentTeamBuilderPage() {
  const params = useParams();
  const { addToast } = useToast();
  const teamId = params.id as string;
  const [createdId, setCreatedId] = useState<string | null>(null);
  
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!teamId || teamId === "new") return;
    
    setIsLoading(true);
    getAgentTeam(teamId)
      .then((res) => {
        if (res.ok && res.team) {
          if (res.team.nodes) setNodes(res.team.nodes);
          if (res.team.edges) setEdges(res.team.edges);
        }
      })
      .catch((err) => console.warn("Backend GET failed, preserving canvas:", err))
      .finally(() => setIsLoading(false));
  }, [teamId]);

  const handleSave = async () => {
    try {
      const payload = { 
        name: "New Agent Team", 
        nodes, 
        edges 
      };

      if (teamId === "new" && !createdId) {
        const res = await createAgentTeam(payload);
        if (res.ok && res.team?._id) {
          addToast({ title: "Agent Team created!", type: "success" });
          setCreatedId(res.team._id); 
        } else {
          throw new Error("Failed to create");
        }
      } else {
        const targetId = createdId || teamId;
        await updateAgentTeam(targetId, payload);
        addToast({ title: "Agent Team architecture saved successfully!", type: "success" });
      }
    } catch (error) {
      console.error(error);
      addToast({ title: "Failed to save team", type: "error" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground">
        Loading Agent Canvas...
      </div>
    );
  }
  const activeId = createdId || (teamId !== "new" ? teamId : null);

  return (
    <div className="flex flex-col h-screen bg-background p-4 md:p-6">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/agents">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Agent Team Architecture</h2>
            <p className="text-sm text-muted-foreground">Design A2A communication pathways</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeId && (
            <Link href={`/agent-teams/${activeId}/chat`}>
              <Button size="sm" variant="outline" className="gap-2 border-indigo-500 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950">
                <Play className="size-4" /> Open War Room
              </Button>
            </Link>
          )}

          <Button onClick={handleSave} size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Save className="size-4" /> Save Architecture
          </Button>
        </div>
      </div>
      
      <AgentTeamBuilder 
        nodes={nodes}
        setNodes={setNodes}
        edges={edges}
        setEdges={setEdges}
      />
    </div>
  );
}
'use client';

import type { Connection, Edge, Node, NodeChange, EdgeChange } from 'reactflow';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { generateNodeId, generateEdgeId } from '@/utils/ids';
import { AgentNode, type AgentTeamNodeData } from './AgentNode';
import { AgentInspectorPanel } from './AgentInspectorPanel';
import { apiGet } from '@/lib/api';
import type { WorkflowPayload } from '@/types/workflow';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';

const EDGE_STYLE = { strokeWidth: 2, stroke: '#6366f1', strokeDasharray: '5,5' };
const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  animated: true,
  style: EDGE_STYLE,
};

export function AgentTeamBuilder({
  nodes,
  setNodes,
  edges,
  setEdges,
}: {
  nodes: Node<AgentTeamNodeData>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<AgentTeamNodeData>[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [availableWorkflows, setAvailableWorkflows] = useState<WorkflowPayload[]>([]);

  const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

  useEffect(() => {
    apiGet<{ ok: boolean; workflows: WorkflowPayload[] }>('/workflows')
      .then((res) => {
        if (res.ok && res.workflows) setAvailableWorkflows(res.workflows);
      })
      .catch(console.error);
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds) as Node<AgentTeamNodeData>[]),
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, id: generateEdgeId(), animated: true, style: EDGE_STYLE }, eds)),
    [setEdges]
  );

  const addAgent = useCallback(() => {
    const id = generateNodeId('agent');
    const newNode: Node<AgentTeamNodeData> = {
      id,
      type: 'agent',
      position: { x: Math.random() * 150 + 100, y: Math.random() * 150 + 100 },
      data: {
        id,
        label: 'New Agent',
        role: 'Assistant',
        allowedWorkflows: [],
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const updateNodeData = useCallback((nodeId: string, patch: Partial<AgentTeamNodeData>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  }, [setNodes]);

  return (
    <div className="flex flex-col flex-1 w-full h-[calc(100vh-140px)] min-h-[600px] relative overflow-hidden bg-background border rounded-lg shadow-sm">
      <div className="absolute top-4 left-4 z-10">
        <Button onClick={addAgent} size="sm" variant="secondary" className="gap-2 shadow-sm border">
          <Bot className="size-4" /> Add Agent Node
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        fitView
      >
        <Controls className="bg-card border rounded-md shadow" />
        <Background gap={24} size={1} color="#e2e8f0" />
        <MiniMap className="bg-card border rounded-md shadow-sm hidden sm:block !bottom-4 !right-4" />
      </ReactFlow>

      <AgentInspectorPanel
        selectedNodeId={selectedNodeId}
        nodes={nodes as unknown as { id: string; data: AgentTeamNodeData }[]}
        availableWorkflows={availableWorkflows.map(w => ({ _id: w._id, name: w.name }))}
        onUpdateNode={updateNodeData}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
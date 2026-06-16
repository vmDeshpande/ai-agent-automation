'use client';

import type { Connection, Node, NodeDragHandler, Edge, NodeChange, EdgeChange } from 'reactflow';
import ReactFlow, {
  Controls,
  Background,
  addEdge,
  useNodesState,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { apiUrl } from '@/lib/api';
import { generateNodeId, generateEdgeId } from '@/utils/ids';
import { duplicateNodesSafely } from '@/utils/graphValidation';
import { X, AlertTriangle } from 'lucide-react';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import type {
  StepType,
  ToolType,
  WorkflowNode,
  WorkflowEdge,
  WorkflowDocument,
  McpTool,
} from '@/types/workflow';

type StepNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: React.ReactElement;
  };
  style?: React.CSSProperties;
};

const EDGE_STYLE = { strokeWidth: 2 };

/* ---------- NODE COLORS ---------- */

function getNodeColor(type: string) {
  switch (type) {
    case 'LLM':
      return '#7c3aed'; // purple
    case 'HTTP':
      return '#2563eb'; // blue
    case 'Tool':
      return '#f59e0b'; // orange
    case 'MCP':
      return '#0f766e'; // teal
    case 'Document':
      return '#16a34a'; // green
    case 'Delay':
      return '#6b7280'; // gray
    case 'Parallel':
      return '#ec4899'; // pink
    case 'Join':
      return '#8b5cf6'; // violet
    default:
      return '#374151';
  }
}

function buildNodePreview(
  step: WorkflowNode | undefined,
  edges: WorkflowEdge[],
  allSteps: WorkflowNode[]
) {
  const rows: { name: string; type: string }[] = [];

  if (!step) return rows;

  if (step.type === 'LLM') {
    rows.push({ name: 'prompt', type: 'string' });

    if (step.useMemory) {
      rows.push({ name: 'memory', type: 'agent' });
      rows.push({ name: 'memoryTopK', type: 'number' });
    }

    rows.push({ name: 'output', type: 'text' });
  }

  if (step.type === 'HTTP') {
    rows.push({ name: 'url', type: 'string' });
    rows.push({ name: 'method', type: 'string' });
    rows.push({ name: 'response', type: 'json' });
  }

  if (step.type === 'Delay') {
    rows.push({ name: 'seconds', type: 'number' });
  }

  if (step.type === 'Tool') {
    rows.push({ name: 'tool', type: 'string' });
  }

  if (step.type === 'MCP') {
    rows.push({ name: 'server', type: step.serverId || 'unset' });
    rows.push({ name: 'tool', type: step.toolName || 'unset' });
  }

  if (step.type === 'Document') {
    rows.push({ name: 'query', type: 'string' });
    rows.push({ name: 'topK', type: 'number' });
  }

  if (step.type === 'Condition') {
    const trueEdge = edges.find((e) => e.source === step.id && e.condition === 'true');
    const falseEdge = edges.find((e) => e.source === step.id && e.condition === 'false');

    const trueStep = allSteps.find((s) => s.id === trueEdge?.target);
    const falseStep = allSteps.find((s) => s.id === falseEdge?.target);

    rows.push({ name: 'true ->', type: trueStep?.name || '?' });
    rows.push({ name: 'false ->', type: falseStep?.name || '?' });
  }

  if (step.type === 'Switch') {
    const outgoing = edges.filter((e) => e.source === step.id);
    outgoing.forEach((edge) => {
      const targetStep = allSteps.find((s) => s.id === edge.target);
      rows.push({
        name: edge.caseValue || 'case',
        type: targetStep?.name || '?',
      });
    });
  }

  if (step.type === 'Parallel') {
    rows.push({ name: 'strategy', type: step.failureStrategy || 'fail-fast' });
    const outEdges = edges.filter((e) => e.source === step.id);
    rows.push({ name: 'branches', type: `${outEdges.length}` });
  }

  if (step.type === 'Join') {
    const inEdges = edges.filter((e) => e.target === step.id);
    rows.push({ name: 'merging', type: `${inEdges.length} sources` });
    rows.push({ name: 'output', type: '{{parallel.results}}' });
  }

  return rows;
}

function computeNodes(
  steps: WorkflowNode[],
  flowEdges: WorkflowEdge[],
  invalidNodeIds: Set<string> = new Set()
): StepNode[] {
  if (!steps?.length) return [];

  return steps.map((step, index) => {
    const schema = buildNodePreview(step, flowEdges, steps);
    const hasError = invalidNodeIds.has(step.id);

    return {
      id: step.id,
      type: 'default',
      position: step.position || { x: index * 320, y: 120 },
      data: {
        label: (
          <div className="w-full text-sm">
            <div className="flex items-center justify-between border-b pb-1 mb-2 group">
              <span className="font-semibold truncate flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: hasError ? '#ef4444' : getNodeColor(step.type) }}
                />
                {step.name || 'Untitled Step'}
              </span>

              <div className="flex items-center gap-1">
                {hasError && <AlertTriangle className="size-4 text-red-500" />}

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    const deleteEvent = new CustomEvent('delete-workflow-node', {
                      detail: { nodeId: step.id },
                    });
                    window.dispatchEvent(deleteEvent);
                  }}
                  className="text-red-500 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground mb-2">{step.type}</div>

            <div className="space-y-1">
              {schema.map((row) => (
                <div
                  key={row.name}
                  className="flex justify-between gap-3 text-xs py-1 border-b border-muted/50 last:border-0"
                >
                  <span className="truncate">{row.name}</span>
                  <span className="text-muted-foreground truncate">{row.type}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      style: {
        padding: '12px 16px',
        borderRadius: '12px',
        border: `1px solid ${hasError ? '#ef4444' : getNodeColor(step.type)}`,
        background: 'var(--card)',
        color: 'var(--foreground)',
        fontSize: '14px',
        cursor: 'pointer',
        fontWeight: 500,
        minWidth: 240,
        maxWidth: 240,
        textAlign: 'center' as const,
        boxShadow: hasError
          ? `0 0 0 2px rgba(239,68,68,0.3), 0 2px 6px rgba(0,0,0,0.05)`
          : `0 0 0 1px ${getNodeColor(step.type)}20, 0 2px 6px rgba(0,0,0,0.05)`,
        touchAction: 'none',
      },
    };
  });
}

export default function VisualBuilder({
  steps,
  setSteps,
  edges,
  onEdgesChange,
  onSave,
  invalidNodeIds = [],
}: {
  steps: WorkflowNode[];
  setSteps: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  edges: WorkflowEdge[];
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onSave?: () => void;
  invalidNodeIds?: string[];
}) {
  usePerformanceMonitor('VisualBuilder');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const historyRef = useRef<{ steps: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const futureRef = useRef<{ steps: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const [documents, setDocuments] = useState<WorkflowDocument[]>([]);
  const [mcpTools, setMcpTools] = useState<McpTool[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>(() => (edges as unknown as Edge[]) || []);
  const selectedStep = steps.find((s) => s.id === selectedNode?.id);
  const selectedMcpTool = mcpTools.find(
    (tool) => tool.serverId === selectedStep?.serverId && tool.name === selectedStep?.toolName
  );

  useEffect(() => {
    onEdgesChange(flowEdges as unknown as WorkflowEdge[]);
  }, [flowEdges, onEdgesChange]);

  const deleteNode = useCallback(
    (nodeId: string) => {
      setSteps((prev) => {
        historyRef.current.push({
          steps: [...prev],
          edges: [...flowEdges] as unknown as WorkflowEdge[],
        });
        futureRef.current = [];
        return prev.filter((s) => s.id !== nodeId);
      });
      setFlowEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNode((prev) => (prev?.id === nodeId ? null : prev));
    },
    [setSteps, flowEdges]
  );

  const computedNodes = useMemo(() => {
    const nodesWithErrorsSet = new Set(invalidNodeIds);
    return computeNodes(steps, flowEdges as unknown as WorkflowEdge[], nodesWithErrorsSet);
  }, [steps, flowEdges, invalidNodeIds]);

  const [nodes, setNodes, _onNodesChange] = useNodesState(computedNodes);

  useEffect(() => {
    setNodes((nds) =>
      computedNodes.map((newNode) => {
        const old = nds.find((n) => n.id === newNode.id);
        return old ? { ...old, ...newNode } : newNode;
      })
    );
  }, [computedNodes, setNodes]);

  useEffect(() => {
    const handleNodeDelete = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.nodeId) {
        deleteNode(customEvent.detail.nodeId);
      }
    };
    window.addEventListener('delete-workflow-node', handleNodeDelete);
    return () => window.removeEventListener('delete-workflow-node', handleNodeDelete);
  }, [deleteNode]);

  /* ---------- KEYBOARD SHORTCUT DUPLICATION SAFETY ---------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        const activeSelectedNodes = nodes.filter((n) => n.selected);
        if (!activeSelectedNodes.length) return;

        e.preventDefault();

        const stepsToDuplicate = steps.filter((s) =>
          activeSelectedNodes.some((node) => node.id === s.id)
        );

        const { clonedSteps, idMap } = duplicateNodesSafely(stepsToDuplicate);

        const internalEdgesToDuplicate = flowEdges.filter(
          (edge) =>
            activeSelectedNodes.some((n) => n.id === edge.source) &&
            activeSelectedNodes.some((n) => n.id === edge.target)
        );

        const clonedEdges = internalEdgesToDuplicate.map((edge) => ({
          ...edge,
          id: generateEdgeId(),
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        }));

        historyRef.current.push({
          steps: [...steps],
          edges: [...flowEdges] as unknown as WorkflowEdge[],
        });
        futureRef.current = [];
        setSteps((prev) => [...prev, ...clonedSteps]);
        if (clonedEdges.length > 0) {
          setFlowEdges((prev) => [...prev, ...clonedEdges]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, steps, flowEdges, setSteps]);

  /* ---------- KEYBOARD SHORTCUTS ---------- */
  useEffect(() => {
    const isInputFocused = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = (el as HTMLElement).tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || (el as HTMLElement).isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      if (isMod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (historyRef.current.length === 0) return;
        const snapshot = historyRef.current.pop()!;
        futureRef.current.push({ steps, edges: flowEdges as unknown as WorkflowEdge[] });
        setSteps(snapshot.steps);
        setFlowEdges(snapshot.edges as unknown as Edge[]);
        setSelectedNode(null);
        return;
      }

      if (isMod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (futureRef.current.length === 0) return;
        const snapshot = futureRef.current.pop()!;
        historyRef.current.push({ steps, edges: flowEdges as unknown as WorkflowEdge[] });
        setSteps(snapshot.steps);
        setFlowEdges(snapshot.edges as unknown as Edge[]);
        setSelectedNode(null);
        return;
      }

      if (e.key === 'Delete' && selectedNode) {
        e.preventDefault();
        deleteNode(selectedNode.id);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, selectedNode, steps, flowEdges, deleteNode, setSteps]);

  /* ---------- EVENTS ---------- */

  const onNodeClick = useCallback((_: React.MouseEvent | null, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onNodeDragStart: NodeDragHandler = useCallback(
    (_event, _node) => {
      historyRef.current.push({
        steps: [...steps],
        edges: [...flowEdges] as unknown as WorkflowEdge[],
      });
      futureRef.current = [];
    },
    [steps, flowEdges]
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      historyRef.current.push({
        steps: [...steps],
        edges: [...flowEdges] as unknown as WorkflowEdge[],
      });
      futureRef.current = [];
      setFlowEdges((eds) => eds.filter((edge) => !deletedEdges.some((d) => d.id === edge.id)));
    },
    [steps, flowEdges]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);

        setTimeout(() => {
          setSteps((prev) => {
            let isChanged = false;
            const next = prev.map((step) => {
              const node = updated.find((n) => n.id === step.id);
              if (!node || !node.position) return step;

              if (node.position.x !== step.position?.x || node.position.y !== step.position?.y) {
                isChanged = true;
                return { ...step, position: node.position };
              }
              return step;
            });
            return isChanged ? next : prev;
          });
        }, 0);

        return updated;
      });
    },
    [setNodes, setSteps]
  );

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const hasStructuralChange = changes.some((c) => c.type !== 'select' && c.type !== 'reset');

    if (!hasStructuralChange) return;

    setFlowEdges((eds) => applyEdgeChanges(changes, eds) as Edge[]);
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceStep = steps.find((s) => s.id === params.source);

      const isCondition = sourceStep?.type === 'Condition';
      const isSwitch = sourceStep?.type === 'Switch';
      const isParallel = sourceStep?.type === 'Parallel'; // Allow infinite outbound connections naturally without prompt

      let condition: 'true' | 'false' | null = null;
      let caseValue: string | null = null;

      if (isCondition) {
        const userChoice = prompt('Enter edge type: true / false');

        if (userChoice !== 'true' && userChoice !== 'false') {
          alert('Invalid input');
          return;
        }

        condition = userChoice;
      }

      if (isSwitch) {
        const userInput = prompt('Enter case value');

        if (!userInput?.trim()) {
          alert('Case value required');
          return;
        }

        const value = userInput.trim();

        const alreadyExists = flowEdges.some(
          (e) => e.source === params.source && (e as unknown as WorkflowEdge).caseValue === value
        );

        if (alreadyExists) {
          alert('Case already exists');
          return;
        }

        caseValue = value;
      }

      historyRef.current.push({
        steps: [...steps],
        edges: [...flowEdges] as unknown as WorkflowEdge[],
      });
      futureRef.current = [];

      setFlowEdges((eds) => {
        let filtered = eds;

        if (isCondition && condition) {
          filtered = eds.filter(
            (e) =>
              !(
                (e as unknown as WorkflowEdge).source === params.source &&
                (e as unknown as WorkflowEdge).condition === condition
              )
          );
        }

        // Parallel doesn't need to filter anything because it can have multiple branches
        const newEdge: WorkflowEdge = {
          id: generateEdgeId(),
          ...params,
          source: params.source ?? '',
          target: params.target ?? '',
          animated: true,
          style: EDGE_STYLE,
          label: isParallel ? 'Branch' : (caseValue || condition?.toUpperCase() || ''),
          condition: condition ?? undefined,
          caseValue: caseValue ?? undefined,
        };

        return addEdge(newEdge as unknown as Edge, filtered);
      });
    },
    [steps, flowEdges]
  );

  const updateStep = useCallback(
    (stepId: string, patch: Partial<WorkflowNode>) => {
      historyRef.current.push({
        steps: [...steps],
        edges: [...flowEdges] as unknown as WorkflowEdge[],
      });
      futureRef.current = [];
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
    },
    [steps, flowEdges, setSteps]
  );

  const updateNodeLabel = useCallback(
    (stepId: string, name: string, type: StepType) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;

      const schema = buildNodePreview(
        { ...step, name, type },
        flowEdges as unknown as WorkflowEdge[],
        steps
      );

      setNodes((nds) =>
        nds.map((n) =>
          n.id === stepId
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: (
                    <div className="w-full text-sm">
                      <div className="flex items-center justify-between border-b pb-1 mb-2 group">
                        <span className="font-semibold truncate">{name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const deleteEvent = new CustomEvent('delete-workflow-node', {
                              detail: { nodeId: stepId },
                            });
                            window.dispatchEvent(deleteEvent);
                          }}
                          className="text-red-500 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="text-xs text-muted-foreground mb-2">{type}</div>

                      <div className="space-y-1">
                        {schema.map((row) => (
                          <div
                            key={row.name}
                            className="flex justify-between text-xs py-1 border-b border-muted/50 last:border-0"
                          >
                            <span>{row.name}</span>
                            <span className="text-muted-foreground">{row.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                },
              }
            : n
        )
      );
    },
    [steps, flowEdges, setNodes]
  );

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const res = await fetch(apiUrl('/documents'), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });
        const data = await res.json();
        if (data.ok) {
          setDocuments(data.documents || []);
        }
      } catch (err) {
        console.error('Failed to load documents', err);
      }
    }
    fetchDocuments();
  }, []);

  useEffect(() => {
    async function fetchMcpTools() {
      try {
        const res = await fetch(apiUrl('/mcp/tools'), {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
          },
        });
        const data = await res.json();
        if (data.ok) {
          setMcpTools(data.tools || []);
        }
      } catch (err) {
        console.error('Failed to load MCP tools', err);
      }
    }

    fetchMcpTools();
  }, []);

  useEffect(() => {
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((node) => {
        const step = steps.find((s) => s.id === node.id);
        if (!step) return node;

        const isSelected = selectedNode?.id === node.id;
        const borderString = String(node.style?.border || '');
        const isInvalid = borderString.includes('#ef4444') || borderString.includes('rgb(239, 68');

        const baseColor = isInvalid ? '#ef4444' : getNodeColor(step.type);

        const border = isSelected
          ? `2px solid ${isInvalid ? '#dc2626' : '#3b82f6'}`
          : `1px solid ${baseColor}`;

        const boxShadow = isSelected
          ? `0 0 0 2px ${isInvalid ? 'rgba(220,38,38,.35)' : 'rgba(59,130,246,.35)'}, 0 4px 12px rgba(0,0,0,.25)`
          : `0 0 0 1px ${baseColor}20, 0 2px 6px rgba(0,0,0,0.05)`;

        if (node.style?.border === border && node.style?.boxShadow === boxShadow) {
          return node;
        }

        changed = true;
        return {
          ...node,
          style: {
            ...node.style,
            border,
            boxShadow,
          },
        };
      });

      return changed ? next : nds;
    });
  }, [selectedNode, steps, setNodes]);

  /* ---------- ADD NODE ---------- */

  const addNode = useCallback(() => {
    const id = generateNodeId('LLM');

    const node: StepNode = {
      id,
      type: 'default',
      position: {
        x: Math.random() * 200 + 100,
        y: Math.random() * 200 + 100,
      },
      data: {
        label: (
          <div className="flex items-center justify-between gap-2">
            <span>New Step (LLM)</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(id);
              }}
              className="text-red-500 hover:text-red-600 text-xs"
            >
              ✕
            </button>
          </div>
        ),
      },
      style: {
        padding: '12px 16px',
        borderRadius: '12px',
        border: `1px solid ${getNodeColor('LLM')}`,
        background: 'var(--card)',
        color: 'var(--foreground)',
        fontSize: '14px',
        fontWeight: 500,
        minWidth: 240,
        cursor: 'pointer',
        maxWidth: 240,
        textAlign: 'center' as const,
        boxShadow: `0 0 0 1px ${getNodeColor('LLM')}20, 0 2px 6px rgba(0,0,0,0.05)`,
        touchAction: 'none',
      },
    };

    historyRef.current.push({
      steps: [...steps],
      edges: [...flowEdges] as unknown as WorkflowEdge[],
    });
    futureRef.current = [];
    setNodes((n) => [...n, node]);
    setSteps((prev) => [
      ...prev,
      {
        id,
        name: 'New Step',
        type: 'LLM',
        prompt: '',
      },
    ]);
  }, [deleteNode, steps, flowEdges, setNodes, setSteps]);

  return (
    <div className="h-[720px] rounded-xl border bg-gradient-to-b from-background to-muted/40 relative overflow-hidden">
      <div className="absolute z-20 top-4 left-4">
        <button
          onClick={addNode}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg shadow-md hover:scale-[1.02] hover:shadow-lg transition"
        >
          + Add Step
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodesDraggable={true}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onEdgesDelete={handleEdgesDelete}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ strokeWidth: 2 }}
        defaultEdgeOptions={{
          type: 'default',
          animated: true,
          labelStyle: {
            fill: 'var(--foreground)',
            fontSize: 12,
            fontWeight: 500,
          },
          labelBgStyle: {
            fill: 'var(--card)',
            fillOpacity: 0.9,
          },
          labelBgPadding: [4, 2],
          labelBgBorderRadius: 4,
          style: { strokeWidth: 2 },
        }}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
      >
        <Controls className="bg-card border rounded-md shadow" />
        <Background gap={24} size={1} />
      </ReactFlow>

      {selectedNode && selectedStep && (
        <div className="absolute right-0 top-0 h-full w-[380px] bg-card border-l shadow-xl z-30 flex flex-col">
          <div className="p-4 border-b flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">Step Settings</h3>
              <p className="text-xs text-muted-foreground">Configure workflow step</p>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-2 rounded-md hover:bg-muted transition"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <label className="text-xs text-muted-foreground">Step Name</label>
              <input
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                value={selectedStep.name || ''}
                onChange={(e) => {
                  updateStep(selectedStep.id, { name: e.target.value });
                  updateNodeLabel(selectedStep.id, e.target.value, selectedStep.type);
                }}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Step Type</label>
              <select
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                value={selectedStep.type || ''}
                onChange={(e) => {
                  const type = e.target.value as StepType;
                  updateStep(selectedStep.id, { type });
                  updateNodeLabel(selectedStep.id, selectedStep.name, type);
                }}
              >
                <option value="" disabled>
                  Select step type
                </option>
                <optgroup label="Logic">
                  <option value="LLM">LLM</option>
                  <option value="HTTP">HTTP</option>
                  <option value="Delay">Delay</option>
                  <option value="Condition">Condition</option>
                  <option value="Switch">Switch</option>
                  <option value="Parallel">Parallel</option>
                  <option value="Join">Join</option>
                </optgroup>
                <optgroup label="Integrations">
                  <option value="Tool">Tool</option>
                  <option value="MCP">MCP</option>
                  <option value="Document">Document</option>
                  <option value="GitHub">GitHub</option>
                  <option value="Slack">Slack</option>
                  <option value="Discord">Discord</option>
                </optgroup>
              </select>
            </div>

            {selectedStep.type === 'Parallel' && (
              <>
                <div className="rounded-lg border border-muted p-3 text-xs text-muted-foreground">
                  Connect multiple outgoing branches. Branches will execute simultaneously.
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Failure Strategy</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={selectedStep.failureStrategy || 'fail-fast'}
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        failureStrategy: e.target.value as "fail-fast" | "continue-on-error",
                      })
                    }
                  >
                    <option value="fail-fast">Fail Fast (Abort all if one fails)</option>
                    <option value="continue-on-error">Continue On Error</option>
                  </select>
                </div>
              </>
            )}

            {selectedStep.type === 'Join' && (
              <div className="rounded-lg border border-muted p-3 text-xs text-muted-foreground">
                Connect multiple incoming branches to this node. It will wait for all branches to finish before passing their merged payload (as an array) to the next step.
              </div>
            )}

            {selectedStep.type === 'LLM' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Prompt</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background min-h-[120px]"
                    value={selectedStep.prompt || ''}
                    onChange={(e) => updateStep(selectedStep.id, { prompt: e.target.value })}
                  />
                </div>
                <div className="rounded-lg border border-muted p-4">
                  <p className="text-sm font-semibold mb-3">Advanced Options</p>
                  <div className="flex items-center justify-between">
                    <label className="text-sm cursor-pointer">Use Agent Memory</label>
                    <input
                      type="checkbox"
                      checked={selectedStep.useMemory ?? false}
                      onChange={(e) =>
                        updateStep(selectedStep.id, {
                          useMemory: e.target.checked,
                        })
                      }
                    />
                  </div>
                  {selectedStep.useMemory && (
                    <div className="mt-3">
                      <label className="text-sm">Memory Top K</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                        value={selectedStep.memoryTopK ?? 5}
                        onChange={(e) =>
                          updateStep(selectedStep.id, {
                            memoryTopK: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {selectedStep.type === 'Delay' && (
              <div>
                <label className="text-xs text-muted-foreground">Delay (seconds)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                  value={selectedStep.delay || ''}
                  onChange={(e) =>
                    updateStep(selectedStep.id, {
                      delay: Number(e.target.value),
                    })
                  }
                />
              </div>
            )}

            {selectedStep.type === 'HTTP' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">URL</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.url || ''}
                    onChange={(e) => updateStep(selectedStep.id, { url: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Method</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.method || ''}
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        method: e.target.value as 'GET' | 'POST' | 'PUT' | 'DELETE',
                      })
                    }
                  >
                    <option value="" disabled>
                      Select method
                    </option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
              </>
            )}

            {selectedStep.type === 'Tool' && (
              <div>
                <label className="text-xs text-muted-foreground">Tool</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                  value={selectedStep.tool || ''}
                  onChange={(e) =>
                    updateStep(selectedStep.id, { tool: e.target.value as ToolType })
                  }
                >
                  <option value="" disabled>
                    Select tool
                  </option>
                  <option value="email">Email</option>
                  <option value="file">File</option>
                  <option value="browser">Browser</option>
                </select>
              </div>
            )}

            {selectedStep.type === 'MCP' && (
              <>
                <div className="rounded-lg border border-muted p-3 text-xs text-muted-foreground">
                  External MCP tools are discovered from your configured MCP servers in Settings.
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Server</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.serverId || ''}
                    onChange={(e) => {
                      updateStep(selectedStep.id, {
                        serverId: e.target.value,
                        toolName: '',
                      });
                    }}
                  >
                    <option value="" disabled>
                      Select server
                    </option>
                    {Array.from(
                      new Map(
                        mcpTools.map((tool) => [tool.serverId, tool.serverName || tool.serverId])
                      ).entries()
                    ).map(([serverId, serverName]) => (
                      <option key={serverId} value={serverId}>
                        {serverName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tool</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.toolName || ''}
                    onChange={(e) => updateStep(selectedStep.id, { toolName: e.target.value })}
                    disabled={!selectedStep.serverId}
                  >
                    <option value="" disabled>
                      Select tool
                    </option>
                    {mcpTools
                      .filter((tool) => tool.serverId === selectedStep.serverId)
                      .map((tool) => (
                        <option key={tool.id} value={tool.name}>
                          {tool.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Timeout (ms)</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.timeoutMs || 30000}
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        timeoutMs: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Arguments (JSON)</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background min-h-[140px] font-mono text-xs"
                    value={selectedStep.arguments || '{\n  \n}'}
                    onChange={(e) => updateStep(selectedStep.id, { arguments: e.target.value })}
                  />
                </div>
                <div className="rounded-lg border border-muted p-3">
                  <div className="text-xs font-medium mb-2">Tool Schema</div>
                  <pre className="text-[11px] leading-5 whitespace-pre-wrap break-words text-muted-foreground">
                    {selectedMcpTool
                      ? JSON.stringify(selectedMcpTool.inputSchema, null, 2)
                      : 'Select an MCP tool to inspect its input schema.'}
                  </pre>
                </div>
              </>
            )}

            {selectedStep.type === 'Tool' && selectedStep.tool === 'email' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.to || ''}
                    onChange={(e) => updateStep(selectedStep.id, { to: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Subject</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.subject || ''}
                    onChange={(e) => updateStep(selectedStep.id, { subject: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Text</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.text || ''}
                    onChange={(e) => updateStep(selectedStep.id, { text: e.target.value })}
                  />
                </div>
              </>
            )}

            {selectedStep.type === 'Tool' && selectedStep.tool === 'file' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Action</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.action || ''}
                    onChange={(e) => updateStep(selectedStep.id, { action: e.target.value })}
                  >
                    <option value="" disabled>
                      Select action
                    </option>
                    <option value="write">Write</option>
                    <option value="append">Append</option>
                    <option value="read">Read</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Path</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.path || ''}
                    onChange={(e) => updateStep(selectedStep.id, { path: e.target.value })}
                  />
                </div>
                {selectedStep.action !== 'read' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Content</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                      value={selectedStep.content || ''}
                      onChange={(e) =>
                        updateStep(selectedStep.id, {
                          content: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </>
            )}

            {selectedStep.type === 'Tool' && selectedStep.tool === 'browser' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Action</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.action || ''}
                    onChange={(e) => updateStep(selectedStep.id, { action: e.target.value })}
                  >
                    <option value="" disabled>
                      Select action
                    </option>
                    <option value="screenshot">Screenshot</option>
                    <option value="evaluate">Evaluate</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">URL</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.url || ''}
                    onChange={(e) => updateStep(selectedStep.id, { url: e.target.value })}
                  />
                </div>
                {selectedStep.action === 'evaluate' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Code</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                      value={selectedStep.code || ''}
                      onChange={(e) => updateStep(selectedStep.id, { code: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}

            {selectedStep.type === 'Document' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Document</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.documentId || ''}
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        documentId: e.target.value,
                      })
                    }
                  >
                    <option value="" disabled>
                      Select document
                    </option>
                    {documents.map((doc) => (
                      <option key={doc._id} value={doc._id}>
                        {doc.title || 'Untitled Document'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Query</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.query || ''}
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        query: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Top K</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 mt-1 bg-background"
                    value={selectedStep.topK || 4}
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        topK: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </>
            )}

            {/* GitHub */}
            {selectedStep.type === 'GitHub' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Action</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={selectedStep.action || ''}
                    onChange={(e) => {
                      updateStep(selectedStep.id, { action: e.target.value });
                    }}
                  >
                    <option value="" disabled>
                      Select action
                    </option>
                    <option value="create_issue">Create Issue</option>
                    <option value="get_issue">Get Issue</option>
                    <option value="comment_issue">Comment Issue</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Owner</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={selectedStep.owner || ''}
                    onChange={(e) => updateStep(selectedStep.id, { owner: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Repo</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={selectedStep.repo || ''}
                    onChange={(e) => updateStep(selectedStep.id, { repo: e.target.value })}
                  />
                </div>
                {selectedStep.action === 'create_issue' && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Title</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                        value={selectedStep.title || ''}
                        onChange={(e) => updateStep(selectedStep.id, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Body</label>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                        value={selectedStep.body || ''}
                        onChange={(e) => updateStep(selectedStep.id, { body: e.target.value })}
                      />
                    </div>
                  </>
                )}
                {(selectedStep.action === 'get_issue' ||
                  selectedStep.action === 'comment_issue') && (
                  <div>
                    <label className="text-xs text-muted-foreground">Issue Number</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                      value={selectedStep.issue_number || ''}
                      onChange={(e) =>
                        updateStep(selectedStep.id, { issue_number: e.target.value })
                      }
                    />
                  </div>
                )}
                {selectedStep.action === 'comment_issue' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Comment</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                      value={selectedStep.comment || ''}
                      onChange={(e) => updateStep(selectedStep.id, { comment: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}

            {/* Slack */}
            {selectedStep.type === 'Slack' && (
              <div>
                <label className="text-xs text-muted-foreground">Message</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                  value={selectedStep.text || ''}
                  onChange={(e) => updateStep(selectedStep.id, { text: e.target.value })}
                />
              </div>
            )}

            {/* Discord */}
            {selectedStep.type === 'Discord' && (
              <div>
                <label className="text-xs text-muted-foreground">Message</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                  value={selectedStep.content || ''}
                  onChange={(e) => updateStep(selectedStep.id, { content: e.target.value })}
                />
              </div>
            )}

            {/* CONDITION */}
            {selectedStep.type === 'Condition' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Condition Type</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={selectedStep.conditionType || ''}
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        conditionType: e.target.value,
                      })
                    }
                  >
                    <option value="">Select operator</option>
                    <option value="boolean">Boolean (Yes/No)</option>
                    <option value="sentiment">Sentiment</option>
                    <option value="contains">Contains Text</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Operator</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                    value={selectedStep.operator || ''}
                    onChange={(e) =>
                      updateStep(selectedStep.id, {
                        operator: e.target.value,
                      })
                    }
                  >
                    <option value="">Select operator</option>
                    {selectedStep.conditionType === 'boolean' && (
                      <>
                        <option value="isTrue">Is True</option>
                        <option value="isFalse">Is False</option>
                      </>
                    )}
                    {selectedStep.conditionType === 'sentiment' && (
                      <>
                        <option value="isPositive">Positive</option>
                        <option value="isNegative">Negative</option>
                      </>
                    )}
                    {selectedStep.conditionType === 'contains' && (
                      <>
                        <option value="includes">Includes</option>
                        <option value="notIncludes">Does Not Include</option>
                      </>
                    )}
                  </select>
                </div>
                {selectedStep.conditionType === 'contains' && (
                  <div>
                    <label className="text-xs text-muted-foreground">Value</label>
                    <input
                      className="w-full border rounded-lg px-3 py-2 mt-1 bg-background"
                      value={selectedStep.value || ''}
                      onChange={(e) =>
                        updateStep(selectedStep.id, {
                          value: e.target.value,
                        })
                      }
                    />
                  </div>
                )}
              </>
            )}

            {selectedStep.type === 'Switch' && (
              <>
                <div className="text-xs text-muted-foreground">Connect edges to define cases.</div>
                <div className="text-xs opacity-70">Each connection = one case value</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

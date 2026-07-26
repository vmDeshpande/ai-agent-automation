'use client';

import type { Connection, Node, NodeDragHandler, Edge, NodeChange, EdgeChange } from 'reactflow';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { apiUrl } from '@/lib/api';
import { generateNodeId, generateEdgeId } from '@/utils/ids';
import { duplicateNodesSafely } from '@/utils/graphValidation';
import { X, AlertTriangle, RefreshCw, Bot } from 'lucide-react';
import { getAgents } from '@/lib/api';
import type { WorkflowAgent } from '@/types/workflow';
import { useParams } from 'next/navigation';
import ReplayDialog from './replay-dialog';
import { QuickAddPalette } from './quick-add-palette';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { BuilderToolbar } from './builder/BuilderToolbar';
import { InspectorPanel } from './builder/InspectorPanel';
import { PremiumNode } from './builder/PremiumNode';
import type {
  StepType,
  ToolType,
  WorkflowNode,
  WorkflowEdge,
  WorkflowDocument,
  McpTool,
  NodeDefinition,
} from '@/types/workflow';
import { useToast } from '@/hooks/use-toast';

type StepNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    id: string;
    label: string;
    type: string;
    hasError?: boolean;
    nodeDef?: NodeDefinition;
    step?: WorkflowNode;
  };
  style?: React.CSSProperties;
};

const EDGE_STYLE = { strokeWidth: 2, stroke: '#94a3b8', strokeDasharray: '5,5' };

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
    case 'Approval':
      return '#ef4444'; // red
    case 'agent_call':
      return '#f43f5e'; // rose
    default:
      return '#374151';
  }
}

function computeNodes(
  steps: WorkflowNode[],
  flowEdges: WorkflowEdge[],
  invalidNodeIds: Set<string> = new Set(),
  nodeDefinitions?: NodeDefinition[],
  agents: WorkflowAgent[] = []
): StepNode[] {
  if (!steps?.length) return [];

  return steps.map((step, index) => {
    const hasError = invalidNodeIds.has(step.id);

    const nodeDef = nodeDefinitions?.find((def) => def.type === step.type);

    return {
      id: step.id,
      type: 'premium',
      position: step.position || { x: index * 320, y: 120 },
      data: {
        id: step.id,
        label: step.name || step.type,
        type: step.type,
        hasError,
        nodeDef,
        step,
      },
    };
  });
}

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  animated: true,
  labelStyle: {
    fill: 'var(--foreground)',
    fontSize: 11,
    fontWeight: 500,
  },
  labelBgStyle: {
    fill: 'var(--card)',
    fillOpacity: 0.8,
    stroke: 'var(--border)',
    strokeWidth: 1,
    rx: 4,
    ry: 4,
  },
  labelBgPadding: [6, 4] as [number, number],
  labelBgBorderRadius: 4,
  style: EDGE_STYLE,
};

export default function VisualBuilder({
  steps,
  setSteps,
  edges,
  onEdgesChange,
  onSave,
  invalidNodeIds = [],
  nodeDefinitions = [],
}: {
  steps: WorkflowNode[];
  setSteps: React.Dispatch<React.SetStateAction<WorkflowNode[]>>;
  edges: WorkflowEdge[];
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onSave?: () => void;
  invalidNodeIds?: string[];
  nodeDefinitions?: NodeDefinition[];
}) {
  usePerformanceMonitor('VisualBuilder');
  const { screenToFlowPosition } = useReactFlow();
  const { id: workflowId } = useParams<{ id: string }>();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [replayNodeId, setReplayNodeId] = useState<string>('');
  const [replayNodeName, setReplayNodeName] = useState<string>('');
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const historyRef = useRef<{ steps: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const futureRef = useRef<{ steps: WorkflowNode[]; edges: WorkflowEdge[] }[]>([]);
  const [documents, setDocuments] = useState<WorkflowDocument[]>([]);
  const [mcpTools, setMcpTools] = useState<McpTool[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>(() => (edges as unknown as Edge[]) || []);
  const [agents, setAgents] = useState<WorkflowAgent[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const selectedStep = steps.find((s) => s.id === selectedNode?.id);
  const { addToast } = useToast();
  const selectedMcpTool = mcpTools.find(
    (tool) => tool.serverId === selectedStep?.serverId && tool.name === selectedStep?.toolName
  );

  const lastPushedEdgesRef = useRef<WorkflowEdge[]>([]);

  const pushEdgesToParent = useCallback(
    (nextEdges: WorkflowEdge[]) => {
      const serializedEdges: WorkflowEdge[] = nextEdges.map((e) => {
        const sourceHandle = (e as any).sourceHandle;
        let condition =
          (e as any).condition || ((e as any).data?.condition as 'true' | 'false' | undefined);
        let caseValue = (e as any).caseValue || ((e as any).data?.caseValue as string | undefined);

        if (!condition && !caseValue && sourceHandle) {
          if (sourceHandle === 'true' || sourceHandle === 'false') {
            condition = sourceHandle;
          } else {
            caseValue = sourceHandle;
          }
        }

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          condition,
          caseValue,
          sourceHandle,
          targetHandle: (e as any).targetHandle,
        } as any;
      });
      lastPushedEdgesRef.current = serializedEdges;
      onEdgesChange(serializedEdges);
    },
    [onEdgesChange]
  );

  useEffect(() => {
    const incoming = edges || [];
    const lastPushed = lastPushedEdgesRef.current || [];

    const isExternalChange =
      incoming.length !== lastPushed.length ||
      incoming.some((e, i) => {
        const lp = lastPushed[i];
        return !lp || lp.id !== e.id || lp.source !== e.source || lp.target !== e.target;
      });

    if (isExternalChange) {
      const mapped = incoming.map((e) => ({
        ...e,
        animated: true,
        style: EDGE_STYLE,
        label:
          e.label || (e.caseValue ? e.caseValue : e.condition ? e.condition.toUpperCase() : ''),
      })) as unknown as Edge[];

      setFlowEdges(mapped);
      lastPushedEdgesRef.current = incoming;
    }
  }, [edges]);

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
      setFlowEdges((eds) => {
        const next = eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
        setTimeout(() => pushEdgesToParent(next as unknown as WorkflowEdge[]), 0);
        return next;
      });
      setSelectedNode((prev) => (prev?.id === nodeId ? null : prev));
    },
    [setSteps, flowEdges, pushEdgesToParent]
  );

  const computedNodes = useMemo(() => {
    const nodesWithErrorsSet = new Set(invalidNodeIds);
    return computeNodes(
      steps,
      flowEdges as unknown as WorkflowEdge[],
      nodesWithErrorsSet,
      nodeDefinitions,
      agents
    );
  }, [steps, flowEdges, invalidNodeIds, nodeDefinitions]);

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

  useEffect(() => {
    const handleNodeReplay = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.nodeId) {
        setReplayNodeId(customEvent.detail.nodeId);
        setReplayNodeName(customEvent.detail.name || 'Untitled Step');
        setReplayModalOpen(true);
      }
    };
    window.addEventListener('replay-workflow-node', handleNodeReplay);
    return () => window.removeEventListener('replay-workflow-node', handleNodeReplay);
  }, []);

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
          setFlowEdges((prev) => {
            const next = [...prev, ...clonedEdges];
            setTimeout(() => pushEdgesToParent(next as unknown as WorkflowEdge[]), 0);
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, steps, flowEdges, setSteps, pushEdgesToParent]);

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
        pushEdgesToParent(snapshot.edges);
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
        pushEdgesToParent(snapshot.edges);
        setSelectedNode(null);
        return;
      }

      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
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
  }, [
    onSave,
    selectedNode,
    steps,
    flowEdges,
    deleteNode,
    setSteps,
    pushEdgesToParent,
    setCommandPaletteOpen,
  ]);

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
      setFlowEdges((eds) => {
        const next = eds.filter((edge) => !deletedEdges.some((d) => d.id === edge.id));
        setTimeout(() => pushEdgesToParent(next as unknown as WorkflowEdge[]), 0);
        return next;
      });
    },
    [steps, flowEdges, pushEdgesToParent]
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

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const hasStructuralChange = changes.some((c) => c.type !== 'select' && c.type !== 'reset');

      if (!hasStructuralChange) return;

      setFlowEdges((eds) => {
        const next = applyEdgeChanges(changes, eds) as Edge[];
        setTimeout(() => pushEdgesToParent(next as unknown as WorkflowEdge[]), 0);
        return next;
      });
    },
    [pushEdgesToParent]
  );

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
          label: isParallel ? 'Branch' : caseValue || condition?.toUpperCase() || '',
          condition: condition ?? undefined,
          caseValue: caseValue ?? undefined,
        };

        const next = addEdge(newEdge as unknown as Edge, filtered);
        setTimeout(() => pushEdgesToParent(next as unknown as WorkflowEdge[]), 0);
        return next;
      });
    },
    [steps, flowEdges, pushEdgesToParent]
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
    (stepId: string, name: string, type: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === stepId
            ? {
                ...n,
                data: {
                  ...n.data,
                  label: name,
                  type: type,
                },
              }
            : n
        )
      );
    },
    [setNodes]
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
    getAgents()
      .then((res) => {
        if (res.ok) setAgents(res.agents || []);
      })
      .catch(console.error);
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

  /* ---------- ADD NODE ---------- */

  const addNode = useCallback(
    (type: string, def?: NodeDefinition) => {
      console.log('addNode called with type:', type);
      const id = generateNodeId(type);

      const defaultConfig: Record<string, any> = {};
      if (def) {
        for (const field of def.fields) {
          if (field.default !== undefined) defaultConfig[field.name] = field.default;
        }
      }

      const node: StepNode = {
        id,
        type: 'premium',
        position: {
          x: Math.random() * 200 + 100,
          y: Math.random() * 200 + 100,
        },
        data: {
          id,
          label: 'New Step',
          type,
        },
      };

      setSteps((prev) => [
        ...prev,
        {
          id,
          name: 'New Step',
          type,
          config: defaultConfig,
          position: {
            x: Math.random() * 200 + 100,
            y: Math.random() * 200 + 100,
          },
        },
      ]);
    },
    [setSteps]
  );

  const wrapperRef = useRef<HTMLDivElement>(null);

  const memoizedNodeTypes = useMemo(
    () => ({
      premium: PremiumNode,
    }),
    []
  );

  useEffect(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      console.log('VisualBuilder');
      console.log('width:', rect.width);
      console.log('height:', rect.height);
      console.log('nodes:', nodes.length);
      console.log('edges:', flowEdges.length);
    }
  });

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col flex-1 w-full h-[calc(100vh-220px)] min-h-[600px] relative overflow-hidden bg-background border rounded-lg"
    >
      <BuilderToolbar
        nodeDefinitions={nodeDefinitions || []}
        onAddNode={addNode}
        onQuickAdd={() => setCommandPaletteOpen(true)}
      />

      <ReactFlow
        className="flex-1"
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={memoizedNodeTypes}
        nodesDraggable={true}
        onConnect={onConnect}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onEdgesDelete={handleEdgesDelete}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        proOptions={{ hideAttribution: true }}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        connectionLineStyle={{ strokeWidth: 2 }}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      >
        <Controls style={{ marginLeft: '220px' }} className="bg-card border rounded-md shadow" />
        <Background gap={24} size={1} color="#e2e8f0" />
        <MiniMap
          className="bg-card border rounded-md shadow-sm overflow-hidden hidden sm:block !bottom-4 !right-4"
          nodeColor={(node) => {
            switch (node.type) {
              case 'premium':
                return '#94a3b8';
              default:
                return '#cbd5e1';
            }
          }}
          maskColor="rgba(0, 0, 0, 0.05)"
        />
      </ReactFlow>

      {/* Command-K "Quick-Add" Palette Modal */}
      <QuickAddPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        nodeDefinitions={nodeDefinitions}
        onSelectNode={(nodeType) => {
          // Determine placement: relative to last selected node, or center of view
          let placementX = 0;
          let placementY = 0;

          if (selectedNode && selectedNode.position) {
            placementX = selectedNode.position.x + 280; // place to the right
            placementY = selectedNode.position.y;
          } else if (nodes.length > 0) {
            // Place next to the last node
            const lastNode = nodes[nodes.length - 1];
            placementX = lastNode.position.x + 280;
            placementY = lastNode.position.y;
          } else {
            // Place at the center of the React Flow viewport
            const flowWrapper = document.querySelector('.react-flow');
            if (flowWrapper) {
              const rect = flowWrapper.getBoundingClientRect();
              const flowCenter = screenToFlowPosition({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              });
              placementX = flowCenter.x - 120; // Offset half node width (240px)
              placementY = flowCenter.y - 40; // Offset approximate half height
            } else {
              placementX = 250;
              placementY = 250;
            }
          }

          const id = generateNodeId(nodeType.toLowerCase());

          // Match custom field default values from definition
          const matchingDef = nodeDefinitions.find((def) => def.id === nodeType);
          const defaultConfig: Record<string, unknown> = {};
          if (matchingDef) {
            matchingDef.fields.forEach((field) => {
              if (field.default !== undefined) {
                defaultConfig[field.name] = field.default;
              }
            });
          }

          const node: StepNode = {
            id,
            type: 'default',
            position: { x: placementX, y: placementY },
            data: {
              label: (
                <div className="flex items-center justify-between gap-2">
                  <span>{matchingDef?.name || nodeType}</span>
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
              border: `1px solid ${getNodeColor(nodeType)}`,
              background: 'var(--card)',
              color: 'var(--foreground)',
              fontSize: '14px',
              fontWeight: 500,
              minWidth: 240,
              cursor: 'pointer',
              maxWidth: 240,
              textAlign: 'center' as const,
              boxShadow: `0 0 0 1px ${getNodeColor(nodeType)}20, 0 2px 6px rgba(0,0,0,0.05)`,
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
              name: matchingDef?.name || `New ${nodeType} Step`,
              type: nodeType as StepType,
              config: defaultConfig,
            },
          ]);

          addToast({
            type: 'success',
            title: `Added "${matchingDef?.name || nodeType}" node`,
          });
        }}
      />

      {/* Keyboard Shortcuts Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/80 backdrop-blur-sm border rounded-md shadow-sm p-3 text-xs text-muted-foreground pointer-events-none hidden md:block z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <kbd className="bg-muted border rounded px-1.5 py-0.5 font-mono text-[10px]">
              ⌘/Ctrl
            </kbd>{' '}
            + <kbd className="bg-muted border rounded px-1.5 py-0.5 font-mono text-[10px]">S</kbd>{' '}
            <span>Save</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-muted border rounded px-1.5 py-0.5 font-mono text-[10px]">
              ⌘/Ctrl
            </kbd>{' '}
            + <kbd className="bg-muted border rounded px-1.5 py-0.5 font-mono text-[10px]">D</kbd>{' '}
            <span>Duplicate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-muted border rounded px-1.5 py-0.5 font-mono text-[10px]">Del</kbd>{' '}
            <span>Delete</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-muted border rounded px-1.5 py-0.5 font-mono text-[10px]">
              ⌘/Ctrl
            </kbd>{' '}
            + <kbd className="bg-muted border rounded px-1.5 py-0.5 font-mono text-[10px]">Z</kbd>{' '}
            <span>Undo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="bg-muted border rounded px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>{' '}
            <span>Quick Add</span>
          </div>
        </div>
      </div>

      <InspectorPanel
        selectedNodeId={selectedNode?.id || null}
        steps={steps}
        edges={flowEdges as unknown as WorkflowEdge[]}
        nodeDefinitions={nodeDefinitions || []}
        documents={documents}
        mcpTools={mcpTools}
        onUpdateStep={updateStep}
        onClose={() => setSelectedNode(null)}
      />

      <ReplayDialog
        workflowId={workflowId}
        startNodeId={replayNodeId}
        startNodeName={replayNodeName}
        open={replayModalOpen}
        onOpenChange={setReplayModalOpen}
      />
    </div>
  );
}

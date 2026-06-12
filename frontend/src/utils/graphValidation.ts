import { generateNodeId, generateEdgeId } from '@/utils/ids';
import { WorkflowNode, WorkflowEdge, ValidationResult } from '@/types/workflow';

/**
 * Deep clones an array of workflow nodes and ensures every node 
 * receives a completely unique ID, shifting their position slightly.
 * Now returns both the cloned steps and an internal translation map 
 * so edge replication can preserve internal connections.
 */
export const duplicateNodesSafely = (
  nodesToDuplicate: WorkflowNode[]
): { clonedSteps: WorkflowNode[]; idMap: Map<string, string> } => {
  const idMap = new Map<string, string>();
  
  const clonedSteps = nodesToDuplicate.map((node) => {
    const clonedNode = JSON.parse(JSON.stringify(node)) as WorkflowNode;
    const newId = generateNodeId(clonedNode.type);
    
    idMap.set(node.id, newId);
    clonedNode.id = newId;
    
    if (clonedNode.position) {
      clonedNode.position.x += 40;
      clonedNode.position.y += 40;
    }
    
    return clonedNode;
  });

  return { clonedSteps, idMap };
};

/**
 * Sanitizes imported workflows/templates by translating potentially conflicting IDs.
 * NOW tracks an internal registry to guard against duplicate IDs embedded *inside* the incoming file itself.
 */
export const sanitizeImportedGraph = (
  importedNodes: WorkflowNode[], 
  importedEdges: WorkflowEdge[], 
  existingNodes: WorkflowNode[]
): { sanitizedNodes: WorkflowNode[]; sanitizedEdges: WorkflowEdge[] } => {
  const existingIds = new Set((existingNodes || []).map((n) => n.id));
  const seenInImport = new Set<string>();
  const idMap = new Map<string, string>();

  const sanitizedNodes = (importedNodes || []).map((node) => {
    let newId = node.id;
    
    // Force regeneration if it hits a canvas conflict OR an intra-bundle collision
    if (existingIds.has(node.id) || seenInImport.has(node.id)) {
      newId = generateNodeId(node.type);
    }
    
    idMap.set(node.id, newId);
    seenInImport.add(newId);

    return {
      ...node,
      id: newId,
    };
  });

  const sanitizedEdges = (importedEdges || []).map((edge) => {
    const sourceId = idMap.get(edge.source) || edge.source;
    const targetId = idMap.get(edge.target) || edge.target;

    return {
      ...edge,
      id: generateEdgeId(),
      source: sourceId,
      target: targetId,
    };
  });

  return { sanitizedNodes, sanitizedEdges };
};

/**
 * Structural & Step Validation Layer
 * Inspects the workflow graph for unreachable nodes, missing fields, and invalid branches.
 */
export const validateGraph = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): ValidationResult => {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const invalidNodes = new Set<string>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  (nodes || []).forEach(n => {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
  });

  const seenIds = new Set<string>();
  (nodes || []).forEach((node) => {
    if (!node.id) {
      errors.push(`Encountered an invalid node structure missing an explicit ID (Type: ${node.type || 'Unknown'}).`);
      return;
    }
    if (seenIds.has(node.id)) {
      errors.push(`Graph Violation: Duplicate Node ID discovered for '${node.name || node.id}'.`);
      invalidNodes.add(node.id);
    }
    seenIds.add(node.id);
    nodeIds.add(node.id);
  });

  (edges || []).forEach((edge) => {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Orphaned Reference: Edge '${edge.id}' references a source node ID '${edge.source}' that does not exist.`);
    } else {
      outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    }
    
    if (!nodeIds.has(edge.target)) {
      errors.push(`Orphaned Reference: Edge '${edge.id}' references a target node ID '${edge.target}' that does not exist.`);
    } else {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  });

  if (nodes && nodes.length > 0) {
    const startNodes = nodes.filter(n => inDegree.get(n.id) === 0);
    
    if (startNodes.length === 0) {
      errors.push("Graph Topology: Workflow lacks a valid starting point.");
    }

    if (nodes.length > 1) {
      nodes.forEach(n => {
        if (inDegree.get(n.id) === 0 && outDegree.get(n.id) === 0) {
          errors.push(`Graph Topology: Node '${n.name || n.type}' is completely disconnected.`);
          invalidNodes.add(n.id);
        }
      });
    }

    const visited = new Set<string>();
    const queue = [...startNodes.map(n => n.id)];
    const adj = new Map<string, string[]>();
    
    nodes.forEach(n => adj.set(n.id, []));
    (edges || []).forEach(e => {
        if (adj.has(e.source)) adj.get(e.source)!.push(e.target);
    });

    while(queue.length > 0) {
        const current = queue.shift()!;
        if (!visited.has(current)) {
            visited.add(current);
            const neighbors = adj.get(current) || [];
            queue.push(...neighbors);
        }
    }

    nodes.forEach(n => {
        if (!visited.has(n.id) && !(inDegree.get(n.id) === 0 && outDegree.get(n.id) === 0)) {
            errors.push(`Graph Topology: Node '${n.name || n.type}' is unreachable from any starting point.`);
            invalidNodes.add(n.id);
        }
    });
  }

  (nodes || []).forEach((node) => {
    const stepName = node.name || node.type;

    if (node.type === "LLM") {
      if (!node.prompt || node.prompt.trim() === "") {
        errors.push(`Step Validation: LLM step '${stepName}' is missing a required prompt.`);
        invalidNodes.add(node.id);
      }
    }

    if (node.type === "Tool") {
      if (!node.tool) {
        errors.push(`Step Validation: Tool step '${stepName}' has no tool type selected.`);
        invalidNodes.add(node.id);
      } else {
         if (node.tool === "email" && (!node.to || node.to.trim() === "")) {
             errors.push(`Step Validation: Email tool '${stepName}' is missing a recipient address.`);
             invalidNodes.add(node.id);
         }
         if (node.tool === "file" && (!node.path || node.path.trim() === "")) {
             errors.push(`Step Validation: File tool '${stepName}' is missing a file path.`);
             invalidNodes.add(node.id);
         }
         if (node.tool === "browser" && node.action !== 'evaluate' && (!node.url || node.url.trim() === "")) {
             errors.push(`Step Validation: Browser tool '${stepName}' is missing a target URL.`);
             invalidNodes.add(node.id);
         }
      }
    }

    if (node.type === "Condition") {
        const outEdges = (edges || []).filter(e => e.source === node.id);
        const hasTrue = outEdges.some(e => e.condition === "true" || e.label?.toLowerCase() === "true");
        const hasFalse = outEdges.some(e => e.condition === "false" || e.label?.toLowerCase() === "false");

        if (!hasTrue || !hasFalse) {
            errors.push(`Step Validation: Condition step '${stepName}' is missing a 'true' or 'false' branch connection.`);
            invalidNodes.add(node.id);
        }
    }

    if (node.type === "Switch") {
        const outEdges = (edges || []).filter(e => e.source === node.id);
        if (outEdges.length === 0) {
            errors.push(`Step Validation: Switch step '${stepName}' has no connected case branches.`);
            invalidNodes.add(node.id);
        }
        outEdges.forEach(e => {
            if (!e.caseValue && !e.label) {
                errors.push(`Step Validation: Switch step '${stepName}' has an outgoing connection without a case value.`);
                invalidNodes.add(node.id);
            }
        });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    invalidNodeIds: Array.from(invalidNodes)
  };
};
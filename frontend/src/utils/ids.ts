import { customAlphabet } from 'nanoid';

// A clean alphabet safe for DOM selectors and IDs
const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const nanoid = customAlphabet(alphabet, 12);

/**
 * Generates a unique, collision-resistant ID for workflow nodes.
 */
export const generateNodeId = (type?: string): string => {
  const prefix = type ? `node_${type.toLowerCase()}` : 'node';
  return `${prefix}_${nanoid()}`;
};

/**
 * Generates a unique, collision-resistant ID for workflow edges.
 */
export const generateEdgeId = (): string => {
  return `edge_${nanoid()}`;
};
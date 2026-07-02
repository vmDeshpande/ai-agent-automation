// src/lib/api.ts

import type {
  WorkflowApiResponse,
  CreateWorkflowPayload,
  UpdateWorkflowPayload,
  UpdateWorkflowStepsPayload,
  AssignAgentPayload,
} from '@/types/workflow';

type ApiError = {
  status: number;
  message: string;
};

type ApiOptions = RequestInit & {
  auth?: boolean; // default: true
};

export const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api`;

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

/* -------------------------------
   Core API helper
-------------------------------- */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const token = auth ? localStorage.getItem('token') : null;

  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: {
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  /* ---- Handle auth expiration globally ---- */
  if (res.status === 401) {
    localStorage.removeItem('token');

    // avoid redirect loops
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }

    throw {
      status: 401,
      message: 'Session expired',
    } satisfies ApiError;
  }

  let data: T;
  try {
    data = (await res.json()) as T;
  } catch {
    throw {
      status: res.status,
      message: 'Invalid server response',
    } satisfies ApiError;
  }

  const ok = (data as Record<string, unknown>)?.ok;
  const error = (data as Record<string, unknown>)?.error;

  if (!res.ok || ok === false) {
    throw {
      status: res.status,
      message: typeof error === 'string' ? error : 'Request failed',
    } satisfies ApiError;
  }

  return data;
}

/* -------------------------------
   Convenience helpers
-------------------------------- */

export function apiGet<T>(path: string) {
  return api<T>(path);
}

export function apiPost<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string) {
  return api<T>(path, { method: 'DELETE' });
}

/* -------------------------------
   Workflow API wrappers
-------------------------------- */

export function getWorkflow(id: string): Promise<WorkflowApiResponse> {
  return apiGet<WorkflowApiResponse>(`/workflows/${id}`);
}

export function createWorkflow(payload: CreateWorkflowPayload): Promise<WorkflowApiResponse> {
  return apiPost<WorkflowApiResponse>(`/workflows`, payload);
}

export function updateWorkflow(
  id: string,
  payload: UpdateWorkflowPayload
): Promise<WorkflowApiResponse> {
  return api<WorkflowApiResponse>(`/workflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function updateWorkflowSteps(
  id: string,
  payload: UpdateWorkflowStepsPayload
): Promise<WorkflowApiResponse> {
  return apiPut<WorkflowApiResponse>(`/workflows/${id}/steps`, payload);
}

export function assignAgent(id: string, payload: AssignAgentPayload): Promise<WorkflowApiResponse> {
  return apiPut<WorkflowApiResponse>(`/workflows/${id}/assign-agent`, payload);
}

export function runWorkflow(id: string): Promise<WorkflowApiResponse> {
  return apiPost<WorkflowApiResponse>(`/workflows/${id}/run`);
}

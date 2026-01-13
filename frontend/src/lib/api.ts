// src/lib/api.ts

type ApiError = {
  status: number;
  message: string;
};

type ApiOptions = RequestInit & {
  auth?: boolean; // default: true
};

const API_BASE = "http://localhost:5000/api";

/* -------------------------------
   Core API helper
-------------------------------- */
export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const token = auth ? localStorage.getItem("token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...headers,
    },
  });

  /* ---- Handle auth expiration globally ---- */
  if (res.status === 401) {
    localStorage.removeItem("token");

    // avoid redirect loops
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }

    throw {
      status: 401,
      message: "Session expired",
    } satisfies ApiError;
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw {
      status: res.status,
      message: "Invalid server response",
    } satisfies ApiError;
  }

  if (!res.ok || data?.ok === false) {
    throw {
      status: res.status,
      message: data?.error || "Request failed",
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
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(path: string, body?: unknown) {
  return api<T>(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(path: string) {
  return api<T>(path, { method: "DELETE" });
}

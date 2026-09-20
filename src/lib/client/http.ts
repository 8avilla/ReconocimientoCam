export interface ApiIssue {
  path: string;
  message: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }

  /** Field-level validation messages keyed by field path. */
  get fieldErrors(): Record<string, string> {
    if (this.code !== "validation_error" || !Array.isArray(this.details)) return {};
    const errors: Record<string, string> = {};
    for (const issue of this.details as ApiIssue[]) {
      if (issue.path && !errors[issue.path]) errors[issue.path] = issue.message;
    }
    return errors;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  json?: unknown;
  signal?: AbortSignal;
}

/** Typed fetch against the app's REST API; throws HttpError with the Spanish message from the server. */
export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? (options.json !== undefined ? "POST" : "GET"),
      headers: options.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new HttpError(0, "No hay conexión con el servidor", "network_error");
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; code?: string; details?: unknown };
    throw new HttpError(response.status, body.error ?? "Ocurrió un error inesperado", body.code, body.details);
  }
  return payload as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado";
}

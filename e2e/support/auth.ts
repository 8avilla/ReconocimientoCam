import type { APIRequestContext, BrowserContext } from "@playwright/test";
import { createUser, E2E_PASSWORD } from "./db";

/**
 * Creates the account (a `zz-qa-…` email) and signs in with the app's own email/password form endpoint, so it works
 * the same against `next dev` and a production build (the test-only provider is never available in production).
 */
export async function login(context: BrowserContext, email: string, name = email): Promise<void> {
  await createUser(email, name);
  const { csrfToken } = await (await context.request.get("/api/auth/csrf")).json();
  const response = await context.request.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password: E2E_PASSWORD, json: "true" },
  });
  const session = await (await context.request.get("/api/auth/session")).json();
  if (!response.ok() || session?.user?.email !== email) throw new Error(`Sign in failed for ${email} (${response.status()})`);
}

/** Small JSON helper over the context's own cookies. */
export function apiOf(request: APIRequestContext) {
  const call = async <T = unknown>(method: "get" | "post" | "delete" | "patch", path: string, data?: unknown) => {
    const response = await request[method](`/api${path}`, data === undefined ? undefined : { data });
    return { status: response.status(), body: (await response.json().catch(() => null)) as T };
  };
  return {
    get: <T = unknown>(path: string) => call<T>("get", path),
    post: <T = unknown>(path: string, data?: unknown) => call<T>("post", path, data ?? {}),
    patch: <T = unknown>(path: string, data?: unknown) => call<T>("patch", path, data ?? {}),
    delete: <T = unknown>(path: string, data?: unknown) => call<T>("delete", path, data),
  };
}

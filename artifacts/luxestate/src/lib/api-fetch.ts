import { supabase } from "./supabase";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers ?? {}),
    },
  });
}

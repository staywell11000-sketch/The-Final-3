import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

export type DocCategory = "contract" | "invoice" | "property_doc" | "other";

export type Document = {
  id: number;
  userId: string;
  dealId: number | null;
  leadId: number | null;
  title: string;
  category: DocCategory;
  fileUrl: string;
  filePath: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDocumentInput = {
  title: string;
  category: DocCategory;
  fileUrl: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  dealId?: number | null;
  leadId?: number | null;
};

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? `Request failed: ${res.status}`);
  return json as T;
}

// ── Upload to Supabase Storage ─────────────────────────────────────────────
export async function uploadToSupabase(
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ filePath: string; fileUrl: string }> {
  // 1. Get a signed upload URL from our API
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const urlRes = await fetch(`${BASE}/documents/signed-upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ fileName: file.name, contentType: file.type }),
  });
  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({}));
    throw new Error(err?.error ?? "Failed to get upload URL");
  }
  const { signedUrl, token: uploadToken, filePath, publicUrl } = await urlRes.json();

  // 2. Upload directly to Supabase Storage using the signed URL
  const { error } = await supabase.storage
    .from("crm-documents")
    .uploadToSignedUrl(filePath, uploadToken, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(error.message);
  if (onProgress) onProgress(100);

  return { filePath, fileUrl: publicUrl };
}

// ── React Query hooks ──────────────────────────────────────────────────────

export function useDocuments(category?: DocCategory | "all") {
  return useQuery<Document[]>({
    queryKey: ["documents", category],
    queryFn: () => {
      const q = category && category !== "all" ? `?category=${category}` : "";
      return authFetch<Document[]>(`/documents${q}`);
    },
    staleTime: 30_000,
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      authFetch<Document>("/documents", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      authFetch<void>(`/documents/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export async function getDownloadUrl(id: number): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${BASE}/documents/${id}/download-url`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to get download URL");
  const json = await res.json();
  return json.url as string;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function inferFileType(mimeType: string | null | undefined): "pdf" | "img" | "doc" | "other" {
  if (!mimeType) return "other";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.startsWith("image/")) return "img";
  if (mimeType.includes("word") || mimeType.includes("document")) return "doc";
  return "other";
}

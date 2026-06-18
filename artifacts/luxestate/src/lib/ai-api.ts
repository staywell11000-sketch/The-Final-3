import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

const API_BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

type LeadAnalysis = {
  score: number;
  urgencyScore: number;
  aiSummary: string;
  suggestedActions: string[];
  signals: { label: string; score: number }[];
  smartReminder: string;
  lead: Record<string, unknown>;
};

type SalesInsights = {
  pipelineScore: number;
  revenueForecasted: string;
  hotLeadsCount: number;
  inactivityAlerts: string[];
  topInsights: string[];
  weeklyTrend: "up" | "down" | "stable";
  weeklyTrendPercent: number;
  conversionRate: number;
  avgDealDays: number;
  totalLeads: number;
  avgScore: number;
  totalDealValue: number;
  statusCounts: Record<string, number>;
};

type ConversationSummary = {
  summary: string;
  keyMoments: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  lastTouchpoint: string;
  relationshipStrength: number;
  nextBestAction: string;
};

async function authFetch(url: string, token: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

export function useAnalyzeLead() {
  const { session } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: number): Promise<LeadAnalysis> => {
      const token = session?.access_token ?? "";
      return authFetch(`${API_BASE}/ai/analyze-lead/${leadId}`, token, { method: "POST" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useSalesInsights() {
  const { session } = useAuth();
  return useQuery<SalesInsights>({
    queryKey: ["ai-sales-insights"],
    queryFn: async () => {
      const token = session?.access_token ?? "";
      return authFetch(`${API_BASE}/ai/sales-insights`, token, { method: "POST" });
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!session,
  });
}

export function useConversationSummary(leadId: number | null) {
  const { session } = useAuth();
  return useQuery<ConversationSummary>({
    queryKey: ["ai-conv-summary", leadId],
    queryFn: async () => {
      const token = session?.access_token ?? "";
      return authFetch(`${API_BASE}/ai/conversation-summary/${leadId}`, token, { method: "POST" });
    },
    enabled: !!session && leadId !== null,
    staleTime: 10 * 60 * 1000,
  });
}

export function useAnalyzeAll(onProgress?: (e: AnalyzeAllEvent) => void) {
  const { session } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      const token = session?.access_token ?? "";
      const res = await fetch(`${API_BASE}/ai/analyze-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to start analysis");
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as AnalyzeAllEvent;
              onProgress?.(event);
            } catch {}
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["ai-sales-insights"] });
    },
  });
}

export type AnalyzeAllEvent =
  | { type: "start"; total: number }
  | { type: "progress"; index: number; total: number; leadId: number; leadName: string; score: number; urgencyScore: number }
  | { type: "error"; leadId: number; leadName: string }
  | { type: "done" }
  | { type: "fatal"; error: string };

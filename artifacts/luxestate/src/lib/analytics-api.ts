import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useAuth } from "./auth-context";
import { useCallback } from "react";
import { supabase } from "./supabase";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const API = `${BASE}/api`;

export type AnalyticsKPIs = {
  totalLeads: number;
  wonLeads: number;
  conversionRate: number;
  totalDeals: number;
  activeDeals: number;
  closedDeals: number;
  totalPipeline: number;
  wonRevenue: number;
  totalProperties: number;
  activeProperties: number;
  teamMembers: number;
  upcomingAppointments: number;
  totalActivities: number;
  activitiesThisWeek: number;
  totalMessages: number;
};

export type SourceBreakdown = { source: string; count: number };
export type AgentPerformance = {
  agent: string; leads: number; won: number;
  winRate: number; avgScore: number; rank: number;
};
export type DealsByStage = { stage: string; count: number; value: number };
export type MessageActivity = { day: string; count: number };
export type ConversionTrend = { month: string; total: number; won: number; rate: number };
export type StatusBreakdown = { status: string; count: number };
export type PriorityBreakdown = { priority: string; count: number };
export type WeeklyActivity = { day: string; leads: number; deals: number };
export type RecentLead = { id: number; name: string; source: string; status: string; createdAt: string; score: number };
export type RecentDeal = { id: number; title: string; stage: string; value: number; updatedAt: string; leadName: string };
export type UpcomingAppointment = { id: number; title: string; dateTime: string; location: string; leadName: string };

export type AnalyticsData = {
  kpis: AnalyticsKPIs;
  sourceBreakdown: SourceBreakdown[];
  agentPerformance: AgentPerformance[];
  dealsByStage: DealsByStage[];
  messageActivity: MessageActivity[];
  conversionTrend: ConversionTrend[];
  statusBreakdown: StatusBreakdown[];
  priorityBreakdown: PriorityBreakdown[];
  weeklyActivity: WeeklyActivity[];
  recentLeads: RecentLead[];
  recentDeals: RecentDeal[];
  upcomingAppointmentsList: UpcomingAppointment[];
};

// Always fetch a fresh token from Supabase rather than using a stale value
// captured in a React state closure. This prevents 401s after token refresh.
async function fetchWithFreshToken(url: string): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return fetch(url, { headers });
}

export function useAnalytics() {
  const { session } = useAuth();

  return useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: async () => {
      let res = await fetchWithFreshToken(`${API}/analytics/overview`);

      // If we get a 401, the token may have just expired. Force a refresh and
      // retry once before surfacing an error.
      if (res.status === 401) {
        await supabase.auth.refreshSession();
        res = await fetchWithFreshToken(`${API}/analytics/overview`);
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.error ?? `Analytics request failed (HTTP ${res.status})`
        );
      }

      return res.json();
    },
    enabled: !!session,
    staleTime: 1000 * 60 * 2,       // 2 min — stay fresh without hammering server
    gcTime: 1000 * 60 * 10,          // Keep cache for 10 min after unmount
    retry: 2,                         // Retry twice before surfacing error
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    // Keep old data visible during background re-fetch so charts don't flash
    placeholderData: keepPreviousData,
  });
}

export function useRefreshAnalytics() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ["analytics"] });
  }, [qc]);
}

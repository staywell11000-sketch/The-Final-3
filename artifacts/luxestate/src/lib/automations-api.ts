import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth-context";

const API = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/api";

export type Condition = {
  field:    string;
  operator: string;
  value:    unknown;
};

export type AutomationAction = {
  type:   string;
  config: Record<string, unknown>;
};

export type Automation = {
  id:              number;
  name:            string;
  description?:    string | null;
  triggerType:     string;
  triggerConfig:   Record<string, unknown>;
  conditions:      Condition[];
  actions:         AutomationAction[];
  isActive:        boolean;
  createdById?:    string | null;
  lastRunAt?:      string | null;
  lastRunStatus?:  string | null;
  runCount:        number;
  errorCount:      number;
  createdAt:       string;
  updatedAt:       string;
};

export type AutomationLog = {
  id:              number;
  automationId:    number;
  leadId?:         number | null;
  triggerType:     string;
  status:          string;
  actionsExecuted: Array<{ type: string; result: string; error?: string }>;
  triggerData:     Record<string, unknown>;
  errorMessage?:   string | null;
  durationMs?:     number | null;
  createdAt:       string;
};

function useApiHeaders() {
  const { session } = useAuth();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

export function useAutomations() {
  const headers = useApiHeaders();
  return useQuery<Automation[]>({
    queryKey: ["automations"],
    queryFn: async () => {
      const res = await fetch(`${API}/automations`, { headers });
      if (!res.ok) throw new Error("Failed to fetch automations");
      return res.json();
    },
  });
}

export function useAutomationLogs(automationId?: number, limit = 50) {
  const headers = useApiHeaders();
  const params = new URLSearchParams({ limit: String(limit) });
  if (automationId) params.set("automationId", String(automationId));
  return useQuery<AutomationLog[]>({
    queryKey:  ["automation-logs", automationId, limit],
    queryFn:   async () => {
      const res = await fetch(`${API}/automation-logs?${params}`, { headers });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function useCreateAutomation() {
  const headers = useApiHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<Automation>) => {
      const res = await fetch(`${API}/automations`, { method: "POST", headers, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to create automation");
      return res.json() as Promise<Automation>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useUpdateAutomation() {
  const headers = useApiHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Automation> & { id: number }) => {
      const res = await fetch(`${API}/automations/${id}`, { method: "PUT", headers, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed to update automation");
      return res.json() as Promise<Automation>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useToggleAutomation() {
  const headers = useApiHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/automations/${id}/toggle`, { method: "PATCH", headers });
      if (!res.ok) throw new Error("Failed to toggle automation");
      return res.json() as Promise<Automation>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useDeleteAutomation() {
  const headers = useApiHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/automations/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Failed to delete automation");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useCloneAutomation() {
  const headers = useApiHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/automations/${id}/clone`, { method: "POST", headers });
      if (!res.ok) throw new Error("Failed to clone automation");
      return res.json() as Promise<Automation>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
  });
}

export function useTestAutomation() {
  const headers = useApiHeaders();
  return useMutation({
    mutationFn: async ({ id, leadId }: { id: number; leadId?: number }) => {
      const res = await fetch(`${API}/automations/${id}/test`, {
        method: "POST",
        headers,
        body:   JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Test failed");
      return data as { message: string };
    },
  });
}

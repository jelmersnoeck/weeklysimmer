// Typed fetch wrappers around the backend API.
// Every call throws an Error carrying the server's { error } message on non-2xx.

import type {
  AdjustInput,
  DietConflict,
  GeneratePlanInput,
  GeneratePlanResult,
  Job,
  Options,
  PlanBundle,
  PlanSnapshot,
  PlanSummary,
  Settings,
  ShoppingItem,
} from "../types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    // Never serve API responses from the HTTP cache — a plan's shopping list changes
    // after adjustments/regenerations and the UI must always see the latest.
    cache: "no-store",
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      // Body was not JSON; keep the status-based message.
    }
    throw new Error(message);
  }

  // 204 / empty bodies are rare here, but guard anyway.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function getSettings(): Promise<Settings> {
  return request<Settings>("/api/settings");
}

// Persist the full settings profile. The server forces configured:true and
// returns the saved settings plus any non-blocking diet conflicts.
export function updateSettings(
  settings: Settings,
): Promise<{ settings: Settings; conflicts: DietConflict[] }> {
  return request<{ settings: Settings; conflicts: DietConflict[] }>(
    "/api/settings",
    {
      method: "PUT",
      body: JSON.stringify(settings),
    },
  );
}

// Canonical option lists + appetite-factor table for the preferences UI.
export function getOptions(): Promise<Options> {
  return request<Options>("/api/options");
}

// Kicks off background generation; resolves to the job handle from the 202.
export function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  return request<GeneratePlanResult>("/api/plans/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listJobs(): Promise<Job[]> {
  return request<Job[]>("/api/jobs");
}

export function getJob(id: string): Promise<Job> {
  return request<Job>(`/api/jobs/${id}`);
}

export function listPlans(): Promise<PlanSummary[]> {
  return request<PlanSummary[]>("/api/plans");
}

export function getPlan(id: number): Promise<PlanBundle> {
  return request<PlanBundle>(`/api/plans/${id}`);
}

export function rateMeal(mealId: number, rating: number): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/meals/${mealId}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

export function regenerateMeal(planId: number, mealId: number): Promise<PlanBundle> {
  return request<PlanBundle>(`/api/plans/${planId}/meals/${mealId}/regenerate`, {
    method: "POST",
  });
}

// Kicks off a background mid-week adjustment; resolves to the job handle (202).
export function adjustWeek(
  planId: number,
  input: AdjustInput,
): Promise<{ jobId: string }> {
  return request<{ jobId: string }>(`/api/plans/${planId}/adjust`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listSnapshots(planId: number): Promise<PlanSnapshot[]> {
  return request<PlanSnapshot[]>(`/api/plans/${planId}/snapshots`);
}

// Recalculate the shopping list from the plan's current meals and return the fresh list.
export function recomputeShopping(
  planId: number,
): Promise<{ shopping: ShoppingItem[] }> {
  return request<{ shopping: ShoppingItem[] }>(
    `/api/plans/${planId}/shopping/recompute`,
    { method: "POST" },
  );
}

// Typed fetch wrappers around the backend API.
// Every call throws an Error carrying the server's { error } message on non-2xx.

import type {
  GeneratePlanInput,
  GeneratePlanResult,
  PlanBundle,
  PlanSummary,
  Settings,
} from "../types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
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

export function generatePlan(input: GeneratePlanInput): Promise<GeneratePlanResult> {
  return request<GeneratePlanResult>("/api/plans/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
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

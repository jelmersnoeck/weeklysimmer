import { useEffect, useState } from "react";
import type { PlanSummary } from "../types";
import { listPlans } from "../api/client";
import "./History.css";

interface HistoryProps {
  onOpenPlan: (id: number) => void;
}

type Status = "loading" | "empty" | "ready" | "error";

function formatWeek(weekStart: string): string {
  const date = new Date(weekStart);
  if (Number.isNaN(date.getTime())) return weekStart;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function History({ onOpenPlan }: HistoryProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setStatus("loading");
      setError(null);
      try {
        const data = await listPlans();
        if (!active) return;
        setPlans(data);
        setStatus(data.length === 0 ? "empty" : "ready");
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Could not load your past plans.",
        );
        setStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="history__state" role="status">
        Loading past weeks…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="history__state history__state--error" role="alert">
        {error}
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="history__state">
        No past weeks yet. Plan a week from the dashboard to start your history.
      </div>
    );
  }

  return (
    <div className="history">
      <h2 className="history__title">Past weeks</h2>
      <ul className="history__list">
        {plans.map((plan) => {
          const avg =
            typeof plan.avgRating === "number" ? plan.avgRating : null;
          return (
            <li key={plan.id}>
              <button
                type="button"
                className="history__row"
                onClick={() => onOpenPlan(plan.id)}
              >
                <span className="history__row-main">
                  <span className="history__week">
                    Week of {formatWeek(plan.weekStart)}
                  </span>
                  {plan.note && (
                    <span className="history__note">{plan.note}</span>
                  )}
                </span>
                <span className="history__row-meta">
                  {avg != null && (
                    <span className="mono history__rating" aria-label={`Average rating ${avg.toFixed(1)} of 5`}>
                      ★ {avg.toFixed(1)}
                    </span>
                  )}
                  <span className={`history__status history__status--${plan.status}`}>
                    {plan.status}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

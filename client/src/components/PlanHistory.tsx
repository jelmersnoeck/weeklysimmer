import { useState } from "react";
import type { AdjustScope, PlanSnapshot } from "../types";
import { listSnapshots } from "../api/client";
import { DAY_LABELS_LONG, slotLabel } from "../lib/meal";
import "./PlanHistory.css";

/** "Tuesday, Thursday" or "from Wednesday lunch" — what an adjustment re-planned. */
function scopeText(scope: AdjustScope): string {
  if (scope.kind === "days") {
    const names = scope.days.map((d) => DAY_LABELS_LONG[d] ?? `day ${d}`);
    return names.length > 0 ? names.join(", ") : "selected days";
  }
  return `from ${DAY_LABELS_LONG[scope.day] ?? `day ${scope.day}`} ${slotLabel(
    scope.slot,
  ).toLowerCase()}`;
}

interface PlanHistoryProps {
  planId: number;
}

function formatWhen(iso: string): string {
  // Server timestamps are UTC ("YYYY-MM-DD HH:MM:SS"); render in local time.
  const date = new Date(iso.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * A collapsible list of the pre-adjustment snapshots saved for a plan. Loaded lazily
 * the first time it's opened so the dashboard doesn't pay for it on every render.
 */
export function PlanHistory({ planId }: PlanHistoryProps) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<PlanSnapshot[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && snapshots === null && !loading) {
      setLoading(true);
      try {
        setSnapshots(await listSnapshots(planId));
      } catch {
        setSnapshots([]);
      } finally {
        setLoading(false);
      }
    }
  }

  const count = snapshots?.length ?? 0;

  return (
    <section className="plan-history">
      <button
        type="button"
        className="plan-history__toggle"
        aria-expanded={open}
        onClick={() => void toggle()}
      >
        {open ? "▾" : "▸"} Previous versions
        {snapshots !== null && count > 0 ? ` (${count})` : ""}
      </button>

      {open && (
        <div className="plan-history__body">
          {loading && <p className="plan-history__muted">Loading…</p>}
          {!loading && count === 0 && (
            <p className="plan-history__muted">
              No adjustments yet — this is the original plan.
            </p>
          )}
          {!loading &&
            snapshots?.map((snap) => (
              <article key={snap.id} className="plan-history__item">
                <header className="plan-history__item-head">
                  <span className="plan-history__when">{formatWhen(snap.createdAt)}</span>
                  <span className="plan-history__cutoff">
                    re-planned {scopeText(snap.scope)}
                  </span>
                </header>
                {snap.note && <p className="plan-history__note">“{snap.note}”</p>}
                <p className="plan-history__meals">
                  {snap.meals.map((m) => m.title).join(" · ")}
                </p>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}

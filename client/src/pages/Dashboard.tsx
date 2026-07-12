import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GeneratePlanInput,
  Meal,
  MealSchedule,
  MeasurementSystem,
  PlanBundle,
  PlanSummary,
} from "../types";
import {
  generatePlan,
  getJob,
  getPlan,
  getSettings,
  listJobs,
  listPlans,
} from "../api/client";
import { GeneratingPanel } from "../components/GeneratingPanel";
import { MealDetail } from "../components/MealDetail";
import { NewWeekForm } from "../components/NewWeekForm";
import { ShoppingList } from "../components/ShoppingList";
import { WeekGrid } from "../components/WeekGrid";
import { SLOT_ORDER } from "../lib/meal";
import "./Dashboard.css";

// Fallback schedule (all meals on) when settings haven't loaded yet.
function allOnSchedule(): MealSchedule {
  return Object.fromEntries(
    SLOT_ORDER.map((slot) => [slot, Array(7).fill(true)]),
  ) as MealSchedule;
}

interface DashboardProps {
  // Which plan to show; null means "the most recent plan".
  selectedPlanId: number | null;
  onSelectPlan: (id: number | null) => void;
  // Measurement systems to render quantities in; defaults to metric.
  units?: MeasurementSystem[];
}

type Status = "loading" | "empty" | "ready" | "error";

// The background generation job currently being polled, if any.
interface ActiveJob {
  id: string;
  startedAt: number;
}

const POLL_INTERVAL_MS = 4000;

function formatWeek(weekStart: string): string {
  const date = new Date(weekStart);
  if (Number.isNaN(date.getTime())) return weekStart;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Dashboard({
  selectedPlanId,
  onSelectPlan,
  units = ["metric"],
}: DashboardProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<PlanBundle | null>(null);
  const [recentTitles, setRecentTitles] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [defaultSchedule, setDefaultSchedule] =
    useState<MealSchedule>(allOnSchedule);

  // Keep the latest onSelectPlan in a ref so the polling effect can call it
  // without listing it as a dependency (which would restart polling).
  const onSelectPlanRef = useRef(onSelectPlan);
  onSelectPlanRef.current = onSelectPlan;

  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active && settings.mealSchedule) {
          setDefaultSchedule(settings.mealSchedule);
        }
      })
      .catch(() => {
        // Non-fatal: fall back to the all-on default schedule.
      });
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const plans = await listPlans();
      if (plans.length === 0) {
        setBundle(null);
        setRecentTitles([]);
        setStatus("empty");
        return;
      }
      const target =
        (selectedPlanId != null
          ? plans.find((p: PlanSummary) => p.id === selectedPlanId)
          : plans[0]) ?? plans[0];
      const loaded = await getPlan(target.id);
      setBundle(loaded);
      setRecentTitles(loaded.plan.meals.map((m) => m.title));
      setStatus("ready");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong loading your plans.",
      );
      setStatus("error");
    }
  }, [selectedPlanId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Resume on reopen: if a job was still running when the tab was closed, pick
  // the generating animation back up so it feels continuous.
  useEffect(() => {
    let active = true;
    listJobs()
      .then((jobs) => {
        if (!active) return;
        const running = jobs.find((j) => j.status === "running");
        if (running) {
          const startedAt = Date.parse(running.createdAt);
          setActiveJob({
            id: running.id,
            startedAt: Number.isNaN(startedAt) ? Date.now() : startedAt,
          });
        }
      })
      .catch(() => {
        // Non-fatal: no resume, the normal dashboard still loads.
      });
    return () => {
      active = false;
    };
  }, []);

  // Poll the active job until it settles. Uses a self-scheduling timeout so
  // there's never an overlapping request, and cleans up on unmount / settle.
  useEffect(() => {
    if (!activeJob) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(jobId: string) {
      try {
        const job = await getJob(jobId);
        if (cancelled) return;
        if (job.status === "done" && job.planId != null) {
          const loaded = await getPlan(job.planId);
          if (cancelled) return;
          setBundle(loaded);
          setRecentTitles(loaded.plan.meals.map((m) => m.title));
          setStatus("ready");
          setError(null);
          setActiveJob(null);
          onSelectPlanRef.current(job.planId);
          return;
        }
        if (job.status === "error") {
          setError(
            job.error ??
              "Could not generate the plan. Check the details and try again.",
          );
          setActiveJob(null);
          setShowForm(true);
          return;
        }
        // Still running — schedule the next poll.
        timer = setTimeout(() => void poll(jobId), POLL_INTERVAL_MS);
      } catch {
        // Transient network/API hiccup: keep polling rather than giving up.
        if (cancelled) return;
        timer = setTimeout(() => void poll(jobId), POLL_INTERVAL_MS);
      }
    }

    void poll(activeJob.id);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeJob]);

  async function handleGenerate(input: GeneratePlanInput) {
    setSubmitting(true);
    setError(null);
    try {
      const { jobId } = await generatePlan(input);
      setShowForm(false);
      setActiveJob({ id: jobId, startedAt: Date.now() });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate the plan. Check the details and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleRated(rating: number) {
    if (!openMeal) return;
    const mealId = openMeal.id;
    setBundle((prev) =>
      prev
        ? {
            ...prev,
            plan: {
              ...prev.plan,
              meals: prev.plan.meals.map((m) =>
                m.id === mealId ? { ...m, rating } : m,
              ),
            },
          }
        : prev,
    );
    setOpenMeal((m) => (m ? { ...m, rating } : m));
  }

  function handleRegenerated(next: PlanBundle) {
    setBundle(next);
    setOpenMeal(null);
  }

  // A running job takes over the view; polling loads the plan when it's done.
  if (activeJob) {
    return (
      <div className="dashboard">
        <GeneratingPanel startedAt={activeJob.startedAt} />
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="dashboard__state" role="status">
        Loading your week…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="dashboard__state dashboard__state--error" role="alert">
        <p>{error}</p>
        <button type="button" className="btn btn--primary" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  if (status === "empty" || showForm) {
    return (
      <div className="dashboard">
        {status !== "empty" && (
          <div className="dashboard__bar">
            <h2 className="dashboard__bar-title">Plan a new week</h2>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => setShowForm(false)}
            >
              Back
            </button>
          </div>
        )}
        {status === "empty" && !showForm ? (
          <div className="dashboard__empty">
            <h2 className="dashboard__empty-title">No plans yet</h2>
            <p className="dashboard__empty-copy">
              Turn the foods you have on hand into a set of meals and a shopping
              list.
            </p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setShowForm(true)}
            >
              Plan your first week
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p className="dashboard__inline-error" role="alert">
                {error}
              </p>
            )}
            <NewWeekForm
              onGenerate={handleGenerate}
              recentTitles={recentTitles}
              defaultSchedule={defaultSchedule}
              onCancel={status === "empty" ? undefined : () => setShowForm(false)}
              submitting={submitting}
            />
          </>
        )}
      </div>
    );
  }

  if (!bundle) return null;

  return (
    <div className="dashboard">
      <div className="dashboard__bar">
        <div>
          <p className="dashboard__eyebrow">Week of</p>
          <h2 className="dashboard__week">{formatWeek(bundle.plan.weekStart)}</h2>
          {bundle.plan.note && (
            <p className="dashboard__note">{bundle.plan.note}</p>
          )}
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setShowForm(true)}
        >
          New week
        </button>
      </div>

      <WeekGrid
        plan={bundle.plan}
        onSelectMeal={setOpenMeal}
        onHand={bundle.plan.onHand}
      />

      <ShoppingList key={bundle.plan.id} items={bundle.shopping} units={units} />

      {openMeal && (
        <div
          className="dashboard__overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenMeal(null);
          }}
        >
          <MealDetail
            meal={openMeal}
            planId={bundle.plan.id}
            units={units}
            onHand={bundle.plan.onHand}
            onClose={() => setOpenMeal(null)}
            onRated={handleRated}
            onRegenerated={handleRegenerated}
          />
        </div>
      )}
    </div>
  );
}

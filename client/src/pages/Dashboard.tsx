import { useCallback, useEffect, useState } from "react";
import type {
  GeneratePlanInput,
  Meal,
  MealSchedule,
  PlanBundle,
  PlanSummary,
} from "../types";
import { generatePlan, getPlan, getSettings, listPlans } from "../api/client";
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
}

type Status = "loading" | "empty" | "ready" | "error";

function formatWeek(weekStart: string): string {
  const date = new Date(weekStart);
  if (Number.isNaN(date.getTime())) return weekStart;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function Dashboard({ selectedPlanId, onSelectPlan }: DashboardProps) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<PlanBundle | null>(null);
  const [recentTitles, setRecentTitles] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [defaultSchedule, setDefaultSchedule] =
    useState<MealSchedule>(allOnSchedule);

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

  async function handleGenerate(input: GeneratePlanInput) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await generatePlan(input);
      setBundle({
        plan: result.plan,
        shopping: result.shopping,
      });
      setRecentTitles(result.plan.meals.map((m) => m.title));
      setShowForm(false);
      setStatus("ready");
      onSelectPlan(result.planId);
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

      <WeekGrid plan={bundle.plan} onSelectMeal={setOpenMeal} />

      <ShoppingList key={bundle.plan.id} items={bundle.shopping} />

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
            onClose={() => setOpenMeal(null)}
            onRated={handleRated}
            onRegenerated={handleRegenerated}
          />
        </div>
      )}
    </div>
  );
}

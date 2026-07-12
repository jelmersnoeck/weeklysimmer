import type { Meal, WeeklyPlan } from "../types";
import { DAY_LABELS, DAY_LABELS_LONG, SLOT_ORDER, slotLabel } from "../lib/meal";
import { MealCard } from "./MealCard";
import "./WeekGrid.css";

interface WeekGridProps {
  plan: WeeklyPlan;
  onSelectMeal: (meal: Meal) => void;
}

export function WeekGrid({ plan, onSelectMeal }: WeekGridProps) {
  const byDay: Meal[][] = Array.from({ length: 7 }, () => []);
  const usedSlots = new Set<Meal["slot"]>();
  for (const meal of plan.meals) {
    if (meal.day >= 0 && meal.day < 7) byDay[meal.day].push(meal);
    usedSlots.add(meal.slot);
  }

  // Only render slot rows that at least one meal in the week uses, so disabled
  // meal types don't show 7 empty cells. Missing single cells still render empty.
  const visibleSlots = SLOT_ORDER.filter((slot) => usedSlots.has(slot));

  return (
    <div className="week-grid" role="list" aria-label="Week board">
      {DAY_LABELS.map((label, day) => {
        const meals = byDay[day];
        return (
          <section
            key={label}
            className="week-grid__day"
            role="listitem"
            aria-label={DAY_LABELS_LONG[day]}
          >
            <h3 className="week-grid__day-heading">
              <span className="week-grid__day-short">{label}</span>
              <span className="week-grid__day-long">{DAY_LABELS_LONG[day]}</span>
            </h3>
            <div className="week-grid__slots">
              {visibleSlots.map((slot) => {
                const meal = meals.find((m) => m.slot === slot);
                return (
                  <div key={slot} className="week-grid__slot">
                    <span className="week-grid__slot-label">{slotLabel(slot)}</span>
                    {meal ? (
                      <MealCard meal={meal} onSelect={onSelectMeal} />
                    ) : (
                      <p className="week-grid__empty">No meal</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

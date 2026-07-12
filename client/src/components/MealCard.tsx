import type { Meal } from "../types";
import {
  DAY_LABELS,
  PROTEIN_LABELS,
  difficultyLabel,
  mealTotalMinutes,
  proteinTagVariant,
  slotLabel,
} from "../lib/meal";
import { mealUsesOnHand } from "../lib/onHand";
import "./MealCard.css";

interface MealCardProps {
  meal: Meal;
  onSelect: (meal: Meal) => void;
  onHand?: string[];
}

export function MealCard({ meal, onSelect, onHand = [] }: MealCardProps) {
  const isLeftover = Boolean(meal.leftoverOf);
  const totalMinutes = mealTotalMinutes(meal);
  const usesOnHand = mealUsesOnHand(meal, onHand);

  return (
    <button
      type="button"
      className={`meal-card${isLeftover ? " meal-card--leftover" : ""}`}
      onClick={() => onSelect(meal)}
    >
      <span className="meal-card__title">{meal.title}</span>
      <span className="meal-card__cuisine">{meal.cuisine}</span>
      {(totalMinutes !== null || meal.caloriesPerServing != null) && (
        <span className="meal-card__meta">
          {totalMinutes !== null && (
            <span className="meal-card__time">
              ⏱ <span className="mono">{totalMinutes}</span> min
            </span>
          )}
          {meal.caloriesPerServing != null && (
            <span className="meal-card__kcal">
              <span className="mono">{meal.caloriesPerServing}</span> kcal
            </span>
          )}
        </span>
      )}
      <span className="meal-card__tags">
        <span className={`tag ${proteinTagVariant(meal.proteinClass)}`}>
          {PROTEIN_LABELS[meal.proteinClass]}
        </span>
        <span className="tag">{difficultyLabel(meal.difficulty)}</span>
        {usesOnHand.length > 0 && (
          <span
            className="tag meal-card__onhand-badge"
            title={`Uses your ${usesOnHand.join(", ")}`}
          >
            <span aria-hidden="true">🌿</span> Uses your{" "}
            {usesOnHand.length === 1 ? usesOnHand[0] : "ingredients"}
          </span>
        )}
        {isLeftover && meal.leftoverOf && (
          <span className="tag meal-card__leftover-badge">
            Leftovers · {DAY_LABELS[meal.leftoverOf.day]}{" "}
            {slotLabel(meal.leftoverOf.slot)}
          </span>
        )}
      </span>
    </button>
  );
}

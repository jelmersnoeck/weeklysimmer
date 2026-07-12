import type { Meal } from "../types";
import {
  DAY_LABELS,
  PROTEIN_LABELS,
  difficultyLabel,
  proteinTagVariant,
  slotLabel,
} from "../lib/meal";
import "./MealCard.css";

interface MealCardProps {
  meal: Meal;
  onSelect: (meal: Meal) => void;
}

export function MealCard({ meal, onSelect }: MealCardProps) {
  const isLeftover = Boolean(meal.leftoverOf);

  return (
    <button
      type="button"
      className={`meal-card${isLeftover ? " meal-card--leftover" : ""}`}
      onClick={() => onSelect(meal)}
    >
      <span className="meal-card__title">{meal.title}</span>
      <span className="meal-card__cuisine">{meal.cuisine}</span>
      <span className="meal-card__tags">
        <span className={`tag ${proteinTagVariant(meal.proteinClass)}`}>
          {PROTEIN_LABELS[meal.proteinClass]}
        </span>
        <span className="tag">{difficultyLabel(meal.difficulty)}</span>
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

import { useState } from "react";
import type { Meal, MeasurementSystem, PlanBundle } from "../types";
import { rateMeal, regenerateMeal } from "../api/client";
import {
  DAY_LABELS_LONG,
  PROTEIN_LABELS,
  difficultyLabel,
  mealTotalMinutes,
  proteinTagVariant,
  slotLabel,
} from "../lib/meal";
import { mealUsesOnHand } from "../lib/onHand";
import { formatQuantity } from "../lib/quantity";
import "./MealDetail.css";

interface MealDetailProps {
  meal: Meal;
  planId: number;
  units?: MeasurementSystem[];
  onHand?: string[];
  onClose: () => void;
  onRated: (rating: number) => void;
  onRegenerated: (bundle: PlanBundle) => void;
}

const STARS = [1, 2, 3, 4, 5];

export function MealDetail({
  meal,
  planId,
  units = ["metric"],
  onHand = [],
  onClose,
  onRated,
  onRegenerated,
}: MealDetailProps) {
  const [rating, setRating] = useState<number>(meal.rating ?? 0);
  const totalMinutes = mealTotalMinutes(meal);
  const usesOnHand = mealUsesOnHand(meal, onHand);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRate(value: number) {
    const previous = rating;
    setRating(value);
    setError(null);
    try {
      await rateMeal(meal.id, value);
      onRated(value);
    } catch (err) {
      setRating(previous);
      setError(err instanceof Error ? err.message : "Could not save the rating.");
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const bundle = await regenerateMeal(planId, meal.id);
      onRegenerated(bundle);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not regenerate the meal. Try again.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div
      className="meal-detail"
      role="dialog"
      aria-modal="true"
      aria-label={meal.title}
    >
      <header className="meal-detail__head">
        <div>
          <p className="meal-detail__when">
            {DAY_LABELS_LONG[meal.day]} · {slotLabel(meal.slot)}
          </p>
          <h2 className="meal-detail__title">{meal.title}</h2>
          <p className="meal-detail__meta">
            {meal.cuisine}
            <span className={`tag ${proteinTagVariant(meal.proteinClass)}`}>
              {PROTEIN_LABELS[meal.proteinClass]}
            </span>
            <span className="tag">{difficultyLabel(meal.difficulty)}</span>
          </p>
          {totalMinutes !== null && (
            <p className="meal-detail__time">
              Prep <span className="mono">{meal.prepMinutes ?? 0}</span> · Cook{" "}
              <span className="mono">{meal.cookMinutes ?? 0}</span> · Total{" "}
              <span className="mono">{totalMinutes}</span> min
            </p>
          )}
          {meal.caloriesPerServing != null && (
            <p className="meal-detail__time">
              <span className="mono">{meal.caloriesPerServing}</span> kcal / serving
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={onClose}
          aria-label="Close meal detail"
        >
          Close
        </button>
      </header>

      {error && (
        <p className="meal-detail__error" role="alert">
          {error}
        </p>
      )}

      <div className="meal-detail__rating" role="group" aria-label="Rate this meal">
        <span className="meal-detail__rating-label">How was it?</span>
        <div className="meal-detail__stars">
          {STARS.map((value) => (
            <button
              key={value}
              type="button"
              className={`meal-detail__star${value <= rating ? " is-filled" : ""}`}
              aria-label={`Rate ${value} of 5`}
              aria-pressed={value === rating}
              onClick={() => handleRate(value)}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {usesOnHand.length > 0 && (
        <p className="meal-detail__onhand" role="note">
          <span aria-hidden="true">🌿</span> Uses what you had:{" "}
          {usesOnHand.join(", ")}
        </p>
      )}

      <section className="meal-detail__section">
        <h3 className="meal-detail__section-heading">Ingredients</h3>
        <ul className="meal-detail__ingredients">
          {meal.ingredients.map((ing) => (
            <li key={ing.name} className="meal-detail__ingredient">
              <span className="mono meal-detail__qty">
                {formatQuantity(ing, units)}
              </span>
              <span>{ing.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="meal-detail__section">
        <h3 className="meal-detail__section-heading">Steps</h3>
        <ol className="meal-detail__steps">
          {meal.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </section>

      <footer className="meal-detail__foot">
        {meal.sourceUrl && (
          <a
            className="meal-detail__source"
            href={meal.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            View source recipe
          </a>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          {regenerating ? "Regenerating…" : "Regenerate this meal"}
        </button>
      </footer>
    </div>
  );
}

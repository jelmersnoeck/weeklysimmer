import { useMemo, useState } from "react";
import type { EnabledSlot, GeneratePlanInput, MealSchedule, Slot } from "../types";
import { DAY_LABELS, DAY_LABELS_LONG, SLOT_ORDER, slotLabel } from "../lib/meal";
import { upcomingWeekOptions } from "../lib/weeks";
import "./NewWeekForm.css";

interface NewWeekFormProps {
  onGenerate: (input: GeneratePlanInput) => void | Promise<void>;
  recentTitles: string[];
  /** The user's saved default meal schedule; seeds the meal-map grid. */
  defaultSchedule: MealSchedule;
  onCancel?: () => void;
  submitting?: boolean;
  /** Injectable "now" for deterministic tests; defaults to the real current date. */
  today?: Date;
}

// Deep copy so grid edits never mutate the caller's schedule.
function cloneSchedule(schedule: MealSchedule): MealSchedule {
  return Object.fromEntries(
    SLOT_ORDER.map((slot) => [slot, [...(schedule[slot] ?? Array(7).fill(false))]]),
  ) as MealSchedule;
}

// Convert the on/off matrix to the flat list the backend expects.
function toEnabledSlots(schedule: MealSchedule): EnabledSlot[] {
  const out: EnabledSlot[] = [];
  for (const slot of SLOT_ORDER) {
    const days = schedule[slot] ?? [];
    for (let day = 0; day < 7; day++) {
      if (days[day]) out.push({ day, slot });
    }
  }
  return out;
}

export function NewWeekForm({
  onGenerate,
  recentTitles,
  defaultSchedule,
  onCancel,
  submitting = false,
  today,
}: NewWeekFormProps) {
  const weekOptions = useMemo(
    () => upcomingWeekOptions(today ?? new Date()),
    [today],
  );
  const [weekStart, setWeekStart] = useState(weekOptions[0].weekStart);
  const [onHand, setOnHand] = useState<string[]>([]);
  const [onHandDraft, setOnHandDraft] = useState("");
  const [note, setNote] = useState("");
  const [avoid, setAvoid] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<MealSchedule>(() =>
    cloneSchedule(defaultSchedule),
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const uniqueRecent = useMemo(
    () => Array.from(new Set(recentTitles)),
    [recentTitles],
  );

  function addOnHand() {
    const value = onHandDraft.trim();
    if (!value) return;
    setOnHand((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setOnHandDraft("");
  }

  function handleOnHandKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addOnHand();
    }
  }

  function removeOnHand(item: string) {
    setOnHand((prev) => prev.filter((v) => v !== item));
  }

  function toggleCell(slot: Slot, day: number) {
    setScheduleError(null);
    setSchedule((prev) => {
      const next = cloneSchedule(prev);
      next[slot][day] = !next[slot][day];
      return next;
    });
  }

  // Row header: toggle a whole slot across all 7 days.
  // Rule: if any day is on, turn them all off; otherwise turn them all on.
  function toggleSlot(slot: Slot) {
    setScheduleError(null);
    setSchedule((prev) => {
      const next = cloneSchedule(prev);
      const anyOn = next[slot].some(Boolean);
      next[slot] = Array(7).fill(!anyOn);
      return next;
    });
  }

  // Column header: toggle all 5 slots for a single day, same rule.
  function toggleDay(day: number) {
    setScheduleError(null);
    setSchedule((prev) => {
      const next = cloneSchedule(prev);
      const anyOn = SLOT_ORDER.some((slot) => next[slot][day]);
      for (const slot of SLOT_ORDER) next[slot][day] = !anyOn;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const enabledSlots = toEnabledSlots(schedule);
    if (enabledSlots.length === 0) {
      setScheduleError("Pick at least one meal to plan.");
      return;
    }
    void onGenerate({ weekStart, onHand, note: note.trim(), avoid, enabledSlots });
  }

  return (
    <form className="new-week" onSubmit={handleSubmit} aria-label="Plan a new week">
      <div className="new-week__field">
        <label htmlFor="nw-week-start">Week</label>
        <select
          id="nw-week-start"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        >
          {weekOptions.map((opt) => (
            <option key={opt.weekStart} value={opt.weekStart}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="new-week__hint">Weeks run Monday to Sunday.</p>
      </div>

      <div className="new-week__field">
        <label htmlFor="nw-onhand">What foods do you have to use up?</label>
        <input
          id="nw-onhand"
          type="text"
          value={onHandDraft}
          placeholder="Type an item, then press Enter"
          onChange={(e) => setOnHandDraft(e.target.value)}
          onKeyDown={handleOnHandKeyDown}
        />
        <p className="new-week__hint">
          Add anything you already have — veg, leftovers, pantry items — one at a
          time.
        </p>
        {onHand.length > 0 && (
          <ul className="new-week__chips" aria-label="Foods to use up">
            {onHand.map((item) => (
              <li key={item} className="new-week__chip">
                <span>{item}</span>
                <button
                  type="button"
                  className="new-week__chip-remove"
                  aria-label={`Remove ${item}`}
                  onClick={() => removeOnHand(item)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="new-week__field">
        <span className="new-week__label" id="nw-mealmap-label">
          Which meals should we plan?
        </span>
        <p className="new-week__hint">
          Toggle a cell, or a whole row/column, to choose meals for the week.
        </p>
        <div
          className="meal-map"
          role="grid"
          aria-labelledby="nw-mealmap-label"
        >
          <div className="meal-map__row meal-map__row--head" role="row">
            <span className="meal-map__corner" role="columnheader" />
            {DAY_LABELS.map((label, day) => (
              <button
                key={label}
                type="button"
                className="meal-map__col-head"
                role="columnheader"
                aria-label={`Toggle all meals on ${DAY_LABELS_LONG[day]}`}
                onClick={() => toggleDay(day)}
              >
                {label}
              </button>
            ))}
          </div>
          {SLOT_ORDER.map((slot) => (
            <div className="meal-map__row" role="row" key={slot}>
              <button
                type="button"
                className="meal-map__row-head"
                role="rowheader"
                aria-label={`Toggle all ${slotLabel(slot)} meals`}
                onClick={() => toggleSlot(slot)}
              >
                {slotLabel(slot)}
              </button>
              {DAY_LABELS.map((_, day) => {
                const on = Boolean(schedule[slot]?.[day]);
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    className={`meal-map__cell${on ? " is-on" : ""}`}
                    aria-pressed={on}
                    aria-label={`${DAY_LABELS_LONG[day]} ${slotLabel(slot).toLowerCase()}`}
                    onClick={() => toggleCell(slot, day)}
                  />
                );
              })}
            </div>
          ))}
        </div>
        {scheduleError && (
          <p className="new-week__error" role="alert">
            {scheduleError}
          </p>
        )}
      </div>

      <div className="new-week__field">
        <label htmlFor="nw-note">Note</label>
        <textarea
          id="nw-note"
          rows={2}
          value={note}
          placeholder="Anything to keep in mind this week?"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="new-week__field">
        <label htmlFor="nw-avoid">Avoid repeating</label>
        {uniqueRecent.length > 0 ? (
          <select
            id="nw-avoid"
            multiple
            size={Math.min(6, uniqueRecent.length)}
            value={avoid}
            onChange={(e) =>
              setAvoid(
                Array.from(e.target.selectedOptions, (o) => o.value),
              )
            }
          >
            {uniqueRecent.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        ) : (
          <p id="nw-avoid" className="new-week__hint">
            Recent meals will show up here once you have a plan.
          </p>
        )}
      </div>

      <div className="new-week__actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? "Generating…" : "Generate this week"}
        </button>
        {onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

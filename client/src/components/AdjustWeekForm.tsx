import { useState } from "react";
import type { AdjustInput, Slot, WeeklyPlan } from "../types";
import { DAY_LABELS_LONG, SLOT_ORDER, slotLabel } from "../lib/meal";
import { defaultCutoff } from "../lib/weeks";
import "./AdjustWeekForm.css";

interface AdjustWeekFormProps {
  plan: WeeklyPlan;
  onSubmit: (input: AdjustInput) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
  /** Injectable "now" for deterministic tests; defaults to the real current date. */
  today?: Date;
}

export function AdjustWeekForm({
  plan,
  onSubmit,
  onCancel,
  submitting = false,
  today,
}: AdjustWeekFormProps) {
  const initial = defaultCutoff(today ?? new Date(), plan.weekStart);
  const [cutoffDay, setCutoffDay] = useState(initial.day);
  const [cutoffSlot, setCutoffSlot] = useState<Slot>(initial.slot);
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (note.trim().length === 0) return;
    void onSubmit({ note: note.trim(), cutoffDay, cutoffSlot });
  }

  const canSubmit = note.trim().length > 0 && !submitting;

  return (
    <form className="adjust-week" onSubmit={handleSubmit} aria-label="Adjust this week">
      <p className="adjust-week__lead">
        Tell me how to change the rest of the week. Meals before your cut-off are
        treated as already eaten — I&rsquo;ll keep them and won&rsquo;t repeat them.
      </p>

      <div className="adjust-week__cutoff">
        <span className="adjust-week__label">Re-plan from</span>
        <select
          aria-label="Cut-off day"
          value={cutoffDay}
          onChange={(e) => setCutoffDay(Number(e.target.value))}
        >
          {DAY_LABELS_LONG.map((label, day) => (
            <option key={day} value={day}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Cut-off slot"
          value={cutoffSlot}
          onChange={(e) => setCutoffSlot(e.target.value as Slot)}
        >
          {SLOT_ORDER.map((slot) => (
            <option key={slot} value={slot}>
              {slotLabel(slot)}
            </option>
          ))}
        </select>
        <span className="adjust-week__label">onward</span>
      </div>

      <div className="adjust-week__field">
        <label htmlFor="aw-note">What should change?</label>
        <textarea
          id="aw-note"
          rows={3}
          placeholder="e.g. we're eating out Thursday, more veg after that, use up the spinach"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="adjust-week__actions">
        <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
          {submitting ? "Adjusting…" : "Adjust the rest of the week"}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

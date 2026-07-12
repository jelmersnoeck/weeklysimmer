import { useMemo, useState } from "react";
import type { GeneratePlanInput } from "../types";
import "./NewWeekForm.css";

interface NewWeekFormProps {
  onGenerate: (input: GeneratePlanInput) => void | Promise<void>;
  recentTitles: string[];
  onCancel?: () => void;
  submitting?: boolean;
}

function mondayOfThisWeek(): string {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // 0 = Mon
  now.setDate(now.getDate() - day);
  return now.toISOString().slice(0, 10);
}

export function NewWeekForm({
  onGenerate,
  recentTitles,
  onCancel,
  submitting = false,
}: NewWeekFormProps) {
  const [weekStart, setWeekStart] = useState(mondayOfThisWeek);
  const [vegBox, setVegBox] = useState<string[]>([]);
  const [vegDraft, setVegDraft] = useState("");
  const [note, setNote] = useState("");
  const [avoid, setAvoid] = useState<string[]>([]);

  const uniqueRecent = useMemo(
    () => Array.from(new Set(recentTitles)),
    [recentTitles],
  );

  function addVeg() {
    const value = vegDraft.trim();
    if (!value) return;
    setVegBox((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setVegDraft("");
  }

  function handleVegKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addVeg();
    }
  }

  function removeVeg(veg: string) {
    setVegBox((prev) => prev.filter((v) => v !== veg));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void onGenerate({ weekStart, vegBox, note: note.trim(), avoid });
  }

  return (
    <form className="new-week" onSubmit={handleSubmit} aria-label="Plan a new week">
      <div className="new-week__field">
        <label htmlFor="nw-week-start">Week start</label>
        <input
          id="nw-week-start"
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          required
        />
      </div>

      <div className="new-week__field">
        <label htmlFor="nw-veg">Add a vegetable</label>
        <input
          id="nw-veg"
          type="text"
          value={vegDraft}
          placeholder="Type a veg, then press Enter"
          onChange={(e) => setVegDraft(e.target.value)}
          onKeyDown={handleVegKeyDown}
        />
        {vegBox.length > 0 && (
          <ul className="new-week__chips" aria-label="Veg box">
            {vegBox.map((veg) => (
              <li key={veg} className="new-week__chip">
                <span>{veg}</span>
                <button
                  type="button"
                  className="new-week__chip-remove"
                  aria-label={`Remove ${veg}`}
                  onClick={() => removeVeg(veg)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
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

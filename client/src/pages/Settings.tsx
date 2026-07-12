import { useMemo, useState } from "react";
import type {
  DietConflict,
  MeasurementSystem,
  Options,
  ProteinPref,
  Settings as SettingsType,
} from "../types";
import { updateSettings } from "../api/client";
import { dietConflicts } from "../lib/diet";
import { labelize } from "../lib/labels";
import "./Settings.css";

interface SettingsProps {
  initial: SettingsType;
  options: Options;
  mode: "onboarding" | "edit";
  onSaved: (settings: SettingsType) => void;
}

// Stable-ish unique id for a freshly added household member.
function newMemberId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Ensure every protein option has a preference row; default missing to "never".
function normalizeProteins(
  optionKeys: string[],
  existing: ProteinPref[],
): ProteinPref[] {
  const byKey = new Map(existing.map((p) => [p.key, p.frequency] as const));
  return optionKeys.map((key) => ({
    key,
    frequency: byKey.get(key) ?? "never",
  }));
}

// Toggle membership of a key in a string array.
function toggle(list: string[], key: string): string[] {
  return list.includes(key)
    ? list.filter((k) => k !== key)
    : [...list, key];
}

export function Settings({ initial, options, mode, onSaved }: SettingsProps) {
  const [draft, setDraft] = useState<SettingsType>(() => ({
    ...initial,
    proteins: normalizeProteins(options.proteins, initial.proteins),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const conflicts = useMemo(() => dietConflicts(draft), [draft]);
  const conflictKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) set.add(`${c.field}:${c.key}`);
    return set;
  }, [conflicts]);

  function conflictFor(
    field: DietConflict["field"],
    key: string,
  ): DietConflict | undefined {
    return conflicts.find((c) => c.field === field && c.key === key);
  }

  // Resulting servings: sum of each member's appetite factor, rounded up.
  const servings = useMemo(() => {
    const total = draft.household.reduce(
      (sum, m) => sum + (options.appetiteFactor[m.type]?.[m.appetite] ?? 0),
      0,
    );
    return Math.ceil(total);
  }, [draft.household, options.appetiteFactor]);

  function patch(next: Partial<SettingsType>) {
    setDraft((prev) => ({ ...prev, ...next }));
    setSaved(false);
  }

  // --- Household ---
  function updateMember(id: string, next: Partial<SettingsType["household"][number]>) {
    patch({
      household: draft.household.map((m) =>
        m.id === id ? { ...m, ...next } : m,
      ),
    });
  }

  function addMember() {
    patch({
      household: [
        ...draft.household,
        { id: newMemberId(), type: "adult", appetite: "standard" },
      ],
    });
  }

  function removeMember(id: string) {
    if (draft.household.length <= 1) return;
    patch({ household: draft.household.filter((m) => m.id !== id) });
  }

  // --- Diet (multi-select) ---
  function toggleDiet(key: string) {
    patch({ diets: toggle(draft.diets, key) as SettingsType["diets"] });
  }

  // --- Units (multi-select, at least one) ---
  function toggleUnit(key: string) {
    const has = draft.units.includes(key as MeasurementSystem);
    // Keep at least one system selected.
    if (has && draft.units.length <= 1) return;
    patch({ units: toggle(draft.units, key) as SettingsType["units"] });
  }

  // --- Proteins ---
  function setProteinFrequency(key: string, frequency: string) {
    patch({
      proteins: draft.proteins.map((p) =>
        p.key === key
          ? { ...p, frequency: frequency as ProteinPref["frequency"] }
          : p,
      ),
    });
  }

  async function handleSave() {
    if (draft.household.length < 1) {
      setError("Add at least one household member.");
      return;
    }
    if (draft.units.length < 1) {
      setError("Pick at least one measurement system.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await updateSettings(draft);
      setSaved(true);
      onSaved(result.settings);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save your preferences. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="settings">
      <div className="settings__intro">
        <h2 className="settings__title">
          {mode === "onboarding" ? "Let's set up your food preferences" : "Preferences"}
        </h2>
        <p className="settings__lede">
          {mode === "onboarding"
            ? "Tell us about your household and tastes so we can plan meals that fit."
            : "Update your household, tastes and diet. Plans use these to pick meals."}
        </p>
      </div>

      {/* Household */}
      <section className="settings__section" aria-labelledby="set-household">
        <h3 className="settings__section-title" id="set-household">
          Household
        </h3>
        <p className="settings__hint">
          Who are you cooking for? This sets portion sizes.
        </p>
        <ul className="settings__members">
          {draft.household.map((m) => (
            <li className="settings__member" key={m.id}>
              <input
                type="text"
                className="settings__member-name"
                placeholder="Name (optional)"
                aria-label="Member name"
                value={m.name ?? ""}
                onChange={(e) =>
                  updateMember(m.id, {
                    name: e.target.value || undefined,
                  })
                }
              />
              <label className="settings__member-field">
                <span className="settings__sr">Type</span>
                <select
                  aria-label="Member type"
                  value={m.type}
                  onChange={(e) =>
                    updateMember(m.id, {
                      type: e.target.value as typeof m.type,
                    })
                  }
                >
                  {options.memberTypes.map((t) => (
                    <option key={t} value={t}>
                      {labelize(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings__member-field">
                <span className="settings__sr">Appetite</span>
                <select
                  aria-label="Member appetite"
                  value={m.appetite}
                  onChange={(e) =>
                    updateMember(m.id, {
                      appetite: e.target.value as typeof m.appetite,
                    })
                  }
                >
                  {options.appetites.map((a) => (
                    <option key={a} value={a}>
                      {labelize(a)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn--ghost btn--small settings__remove"
                onClick={() => removeMember(m.id)}
                disabled={draft.household.length <= 1}
                aria-label="Remove member"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="settings__members-foot">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={addMember}
          >
            Add person
          </button>
          <p className="settings__hint settings__servings" aria-live="polite">
            Roughly <span className="mono">{servings}</span>{" "}
            {servings === 1 ? "serving" : "servings"} per meal.
          </p>
        </div>
      </section>

      {/* Proteins */}
      <section className="settings__section" aria-labelledby="set-proteins">
        <h3 className="settings__section-title" id="set-proteins">
          Proteins
        </h3>
        <p className="settings__hint">How often would you like each one?</p>
        <ul className="settings__proteins">
          {draft.proteins.map((p) => {
            const conflict = conflictFor("proteins", p.key);
            return (
              <li className="settings__protein" key={p.key}>
                <span className="settings__protein-name">{labelize(p.key)}</span>
                <select
                  aria-label={`${labelize(p.key)} frequency`}
                  value={p.frequency}
                  className={conflict ? "is-conflict" : undefined}
                  onChange={(e) => setProteinFrequency(p.key, e.target.value)}
                >
                  {options.frequencies.map((f) => (
                    <option key={f} value={f}>
                      {labelize(f)}
                    </option>
                  ))}
                </select>
                {conflict && (
                  <span className="settings__warn" role="note">
                    <span aria-hidden="true">⚠</span> {conflict.message}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Likes: vegetables / fruits / cuisines / dish types / flavours */}
      <ChipSection
        id="set-vegetables"
        title="Vegetables you like"
        keys={options.vegetables}
        selected={draft.vegetablesLiked}
        onToggle={(key) => patch({ vegetablesLiked: toggle(draft.vegetablesLiked, key) })}
      />
      <ChipSection
        id="set-fruits"
        title="Fruits you like"
        keys={options.fruits}
        selected={draft.fruitsLiked}
        onToggle={(key) => patch({ fruitsLiked: toggle(draft.fruitsLiked, key) })}
      />
      <ChipSection
        id="set-cuisines"
        title="Cuisines you like"
        keys={options.cuisines}
        selected={draft.cuisinesLiked}
        onToggle={(key) => patch({ cuisinesLiked: toggle(draft.cuisinesLiked, key) })}
      />
      <ChipSection
        id="set-dishtypes"
        title="Dish types you like"
        keys={options.dishTypes}
        selected={draft.dishTypesLiked}
        onToggle={(key) => patch({ dishTypesLiked: toggle(draft.dishTypesLiked, key) })}
        conflictKeys={conflictKeys}
        conflictField="dishTypes"
        conflictFor={conflictFor}
      />
      <ChipSection
        id="set-flavours"
        title="Flavours you like"
        keys={options.flavours}
        selected={draft.flavoursLiked}
        onToggle={(key) => patch({ flavoursLiked: toggle(draft.flavoursLiked, key) })}
        conflictKeys={conflictKeys}
        conflictField="flavours"
        conflictFor={conflictFor}
      />
      <ChipSection
        id="set-avoid"
        title="Avoid these"
        hint="Ingredients to keep out of your meals."
        keys={options.avoids}
        selected={draft.avoid}
        onToggle={(key) => patch({ avoid: toggle(draft.avoid, key) })}
        tone="avoid"
      />

      {/* Diet — multi-select; zero selected means no framework. */}
      <ChipSection
        id="set-diet"
        title="Diet"
        hint="Pick any that apply, or leave all off for no framework."
        keys={options.diets}
        selected={draft.diets}
        onToggle={toggleDiet}
      />

      {/* Units — at least one measurement system stays selected. */}
      <ChipSection
        id="set-units"
        title="Units"
        hint="How should we show quantities? Keep at least one."
        keys={options.measurementSystems}
        selected={draft.units}
        onToggle={toggleUnit}
      />

      {/* Effort */}
      <section className="settings__section" aria-labelledby="set-effort">
        <h3 className="settings__section-title" id="set-effort">
          Effort
        </h3>
        <p className="settings__hint">How involved should the cooking be?</p>
        <div className="settings__radios" role="radiogroup" aria-labelledby="set-effort">
          {(["easy", "medium", "hard"] as const).map((e) => (
            <label
              key={e}
              className={`settings__radio${draft.effort === e ? " is-selected" : ""}`}
            >
              <input
                type="radio"
                name="effort"
                value={e}
                checked={draft.effort === e}
                onChange={() => patch({ effort: e })}
              />
              {labelize(e)}
            </label>
          ))}
        </div>
      </section>

      {/* Conflict summary + save */}
      <div className="settings__foot">
        {conflicts.length > 0 && (
          <div className="settings__conflicts" role="note">
            <p className="settings__conflicts-title">
              Heads up — these choices go against your diet (we'll keep them
              anyway):
            </p>
            <ul>
              {conflicts.map((c) => (
                <li key={`${c.field}:${c.key}`}>{c.message}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p className="settings__error" role="alert">
            {error}
          </p>
        )}
        <div className="settings__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void handleSave()}
            disabled={submitting}
          >
            {submitting
              ? "Saving…"
              : mode === "onboarding"
                ? "Save & continue"
                : "Save preferences"}
          </button>
          {saved && mode === "edit" && (
            <span className="settings__saved" role="status">
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ChipSectionProps {
  id: string;
  title: string;
  hint?: string;
  keys: string[];
  selected: string[];
  onToggle: (key: string) => void;
  tone?: "avoid";
  conflictKeys?: Set<string>;
  conflictField?: DietConflict["field"];
  conflictFor?: (field: DietConflict["field"], key: string) => DietConflict | undefined;
}

function ChipSection({
  id,
  title,
  hint,
  keys,
  selected,
  onToggle,
  tone,
  conflictKeys,
  conflictField,
  conflictFor,
}: ChipSectionProps) {
  return (
    <section className="settings__section" aria-labelledby={id}>
      <h3 className="settings__section-title" id={id}>
        {title}
      </h3>
      {hint && <p className="settings__hint">{hint}</p>}
      <div className="settings__chips" role="group" aria-labelledby={id}>
        {keys.map((key) => {
          const on = selected.includes(key);
          const conflicted =
            on &&
            conflictKeys != null &&
            conflictField != null &&
            conflictKeys.has(`${conflictField}:${key}`);
          const conflict =
            conflicted && conflictFor
              ? conflictFor(conflictField as DietConflict["field"], key)
              : undefined;
          return (
            <button
              key={key}
              type="button"
              className={`settings__chip${on ? " is-on" : ""}${
                tone === "avoid" ? " settings__chip--avoid" : ""
              }${conflicted ? " is-conflict" : ""}`}
              aria-pressed={on}
              title={conflict?.message}
              onClick={() => onToggle(key)}
            >
              {labelize(key)}
              {conflicted && <span aria-hidden="true"> ⚠</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

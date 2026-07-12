import { useEffect, useState } from "react";
import type { Options, Settings as SettingsType } from "./types";
import { getOptions, getSettings } from "./api/client";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";
import "./App.css";

type View = "dashboard" | "history" | "settings";
type LoadStatus = "loading" | "ready" | "error";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [options, setOptions] = useState<Options | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, o] = await Promise.all([getSettings(), getOptions()]);
        if (!active) return;
        setSettings(s);
        setOptions(o);
        setLoadStatus("ready");
      } catch {
        if (active) setLoadStatus("error");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function openPlanFromHistory(id: number) {
    setSelectedPlanId(id);
    setView("dashboard");
  }

  if (loadStatus === "loading") {
    return (
      <div className="app">
        <div className="app__boot" role="status">
          Loading…
        </div>
      </div>
    );
  }

  if (loadStatus === "error" || !settings || !options) {
    return (
      <div className="app">
        <div className="app__boot app__boot--error" role="alert">
          Couldn't load the app. Check your connection and refresh.
        </div>
      </div>
    );
  }

  // Onboarding gate: block everything until the profile is configured.
  if (!settings.configured) {
    return (
      <div className="app">
        <header className="app__header">
          <div className="app__brand">
            <span className="app__mark" aria-hidden="true">
              ▲
            </span>
            <h1 className="app__title">Weekly Simmer</h1>
          </div>
        </header>
        <main className="app__main">
          <Settings
            initial={settings}
            options={options}
            mode="onboarding"
            onSaved={(s) => {
              setSettings(s);
              setView("dashboard");
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <button
          type="button"
          className="app__brand app__brand--home"
          aria-label="Weekly Simmer home"
          onClick={() => {
            setSelectedPlanId(null);
            setView("dashboard");
          }}
        >
          <span className="app__mark" aria-hidden="true">
            ▲
          </span>
          <h1 className="app__title">Weekly Simmer</h1>
        </button>
        <nav className="app__nav" aria-label="Main views">
          <button
            type="button"
            className={`app__tab${view === "dashboard" ? " is-active" : ""}`}
            aria-current={view === "dashboard" ? "page" : undefined}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`app__tab${view === "history" ? " is-active" : ""}`}
            aria-current={view === "history" ? "page" : undefined}
            onClick={() => setView("history")}
          >
            History
          </button>
          <button
            type="button"
            className={`app__tab${view === "settings" ? " is-active" : ""}`}
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="app__main">
        {view === "dashboard" && (
          <Dashboard
            selectedPlanId={selectedPlanId}
            onSelectPlan={setSelectedPlanId}
            units={settings.units}
          />
        )}
        {view === "history" && <History onOpenPlan={openPlanFromHistory} />}
        {view === "settings" && (
          <Settings
            initial={settings}
            options={options}
            mode="edit"
            onSaved={(s) => {
              setSettings(s);
              setView("dashboard");
            }}
          />
        )}
      </main>
    </div>
  );
}

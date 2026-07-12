import { useState } from "react";
import { Dashboard } from "./pages/Dashboard";
import { History } from "./pages/History";
import "./App.css";

type View = "dashboard" | "history";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  function openPlanFromHistory(id: number) {
    setSelectedPlanId(id);
    setView("dashboard");
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__mark" aria-hidden="true">
            ▲
          </span>
          <h1 className="app__title">The Prep Sheet</h1>
        </div>
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
        </nav>
      </header>

      <main className="app__main">
        {view === "dashboard" ? (
          <Dashboard
            selectedPlanId={selectedPlanId}
            onSelectPlan={setSelectedPlanId}
          />
        ) : (
          <History onOpenPlan={openPlanFromHistory} />
        )}
      </main>
    </div>
  );
}

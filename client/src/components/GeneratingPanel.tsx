import { useEffect, useState } from "react";
import "./GeneratingPanel.css";

// Indicative pipeline steps. The backend doesn't stream sub-status, so we
// rotate these on a timer to show the work is progressing.
const STATUS_MESSAGES = [
  "Searching for recipes…",
  "Building your week around what you have…",
  "Balancing protein and variety…",
  "Working out the shopping list…",
];

const MESSAGE_INTERVAL_MS = 4000;

interface GeneratingPanelProps {
  /** When generation began; drives the elapsed timer. Defaults to now. */
  startedAt?: number;
}

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function GeneratingPanel({ startedAt }: GeneratingPanelProps) {
  const [start] = useState(() => startedAt ?? Date.now());
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - start) / 1000)),
  );

  // Tick the elapsed timer every second.
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [start]);

  // Rotate the status messages.
  useEffect(() => {
    const id = setInterval(() => {
      setMessageIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="generating" role="status" aria-live="polite">
      <div className="generating__pot" aria-hidden="true">
        <span className="generating__steam generating__steam--a" />
        <span className="generating__steam generating__steam--b" />
        <span className="generating__steam generating__steam--c" />
        <span className="generating__pot-body" />
      </div>

      <h2 className="generating__title">Cooking up your week</h2>

      <p className="generating__message" key={messageIndex}>
        {STATUS_MESSAGES[messageIndex]}
      </p>

      <p className="generating__elapsed mono" aria-label="Time elapsed">
        {formatElapsed(elapsed)}
      </p>

      <div className="generating__shimmer" aria-hidden="true" />

      <p className="generating__note">
        This runs in the background — you can close this tab and come back.
      </p>
    </section>
  );
}

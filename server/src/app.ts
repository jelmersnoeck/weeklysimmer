import express from "express";
import type Database from "better-sqlite3";
import type { PlanCurator } from "./llm/anthropicClient.js";
import { settingsRouter } from "./routes/settings.js";
import { plansRouter } from "./routes/plans.js";

export interface AppDeps {
  curator: PlanCurator;
}

/**
 * Build the Express app with its dependencies injected (factory DI).
 *
 * Tests inject a fake `PlanCurator` so no network call is ever made. Routes are
 * mounted under `/api`; a final error-handling middleware turns thrown/rejected
 * handlers into a JSON `{ error }` body using `err.status` (default 500).
 */
export function createApp(db: Database.Database, deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json());

  app.use("/api", settingsRouter(db));
  app.use("/api", plansRouter(db, deps));

  // Final error handler. Express v5 forwards rejected async handlers here.
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction,
    ) => {
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? Number((err as { status?: number }).status) || 500
          : 500;
      const message =
        err instanceof Error ? err.message : "Internal Server Error";
      res.status(status).json({ error: message });
    },
  );

  return app;
}

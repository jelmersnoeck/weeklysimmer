import { Router } from "express";
import type { JobStore } from "../jobs/registry.js";

/** Read-only routes exposing the generation job registry. */
export function jobsRouter(store: JobStore): Router {
  const router = Router();

  // List all jobs, newest first.
  router.get("/jobs", (_req, res) => {
    res.json(store.listJobs());
  });

  // Fetch a single job, or 404 if unknown.
  router.get("/jobs/:id", (req, res) => {
    const job = store.getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: "job not found" });
      return;
    }
    res.json(job);
  });

  return router;
}

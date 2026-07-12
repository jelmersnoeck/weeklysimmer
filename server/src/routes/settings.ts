import { Router } from "express";
import type Database from "better-sqlite3";
import { getSettings } from "../db/settingsRepo.js";

/** Routes for reading household settings. */
export function settingsRouter(db: Database.Database): Router {
  const router = Router();

  router.get("/settings", (_req, res) => {
    res.json(getSettings(db));
  });

  return router;
}

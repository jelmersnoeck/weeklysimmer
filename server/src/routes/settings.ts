import { Router } from "express";
import type Database from "better-sqlite3";
import { getSettings, saveSettings } from "../db/settingsRepo.js";
import { validateSettings } from "../domain/settingsValidation.js";
import { dietConflicts } from "../domain/diet.js";
import {
  PROTEINS,
  CUISINES,
  DISH_TYPES,
  FLAVOURS,
  AVOIDS,
  DIETS,
  MEASUREMENT_SYSTEMS,
  VEGETABLES,
  FRUITS,
  FREQUENCIES,
  APPETITES,
  MEMBER_TYPES,
  APPETITE_FACTOR,
} from "../domain/preferences.js";

/** The full set of option lists the preferences UI renders from. */
const OPTIONS = {
  proteins: PROTEINS,
  cuisines: CUISINES,
  dishTypes: DISH_TYPES,
  flavours: FLAVOURS,
  avoids: AVOIDS,
  diets: DIETS,
  measurementSystems: MEASUREMENT_SYSTEMS,
  vegetables: VEGETABLES,
  fruits: FRUITS,
  frequencies: FREQUENCIES,
  appetites: APPETITES,
  memberTypes: MEMBER_TYPES,
  appetiteFactor: APPETITE_FACTOR,
};

/** Routes for reading/writing household settings and listing preference options. */
export function settingsRouter(db: Database.Database): Router {
  const router = Router();

  // Current settings (synthesized default profile when nothing is saved yet).
  router.get("/settings", (_req, res) => {
    res.json(getSettings(db));
  });

  // Option lists + appetite factor table for the preferences UI.
  router.get("/options", (_req, res) => {
    res.json(OPTIONS);
  });

  // Save the user's preferences. 400 on an invalid body; otherwise persist
  // (configured:true) and return the saved settings plus non-blocking diet warnings.
  router.put("/settings", (req, res) => {
    const result = validateSettings(req.body);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const settings = saveSettings(db, result.settings);
    res.json({ settings, conflicts: dietConflicts(settings) });
  });

  return router;
}

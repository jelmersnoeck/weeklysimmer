import "dotenv/config";
import { openDb } from "./db/index.js";
import { seedSettings } from "./db/seed.js";
import { createApp } from "./app.js";
import {
  createAnthropicCurator,
  makeAnthropicClient,
} from "./llm/anthropicClient.js";

const db = openDb(process.env.DATABASE_PATH ?? "./mealplanner.db");

// Seed default settings if the table is empty.
const count = db
  .prepare("SELECT COUNT(*) AS n FROM settings")
  .get() as { n: number };
if (count.n === 0) {
  seedSettings(db);
}

const curator = createAnthropicCurator(makeAnthropicClient());
const port = Number(process.env.PORT ?? 3001);

createApp(db, { curator }).listen(port, () => {
  console.log(`server on ${port}`);
});

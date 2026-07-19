CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,
  on_hand TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  slot TEXT NOT NULL,
  title TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  protein_class TEXT NOT NULL,
  base TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  prep_minutes INTEGER,
  cook_minutes INTEGER,
  calories_per_serving INTEGER,
  servings INTEGER NOT NULL,
  ingredients TEXT NOT NULL,
  steps TEXT NOT NULL,
  source_url TEXT,
  leftover_of TEXT,
  rating INTEGER
);

CREATE TABLE IF NOT EXISTS plan_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  cutoff_day INTEGER NOT NULL,
  cutoff_slot TEXT NOT NULL,
  scope_json TEXT NOT NULL DEFAULT '',
  plan_json TEXT NOT NULL,
  shopping_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  category TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0
);

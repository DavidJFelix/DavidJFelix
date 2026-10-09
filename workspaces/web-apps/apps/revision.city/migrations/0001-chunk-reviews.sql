CREATE TABLE chunk_reviews (
  key TEXT PRIMARY KEY,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

import * as SQLite from "expo-sqlite";

import type { GenerationHistory, ImageInput, ImageResult, ProviderConfig } from "../types";

type HistoryRow = {
  id: string;
  prompt: string;
  provider_json: string;
  input_images_json: string;
  output_images_json: string;
  status: GenerationHistory["status"];
  error_message: string | null;
  created_at: string;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync("image2_history.db");
  return databasePromise;
}

export async function initHistoryStore(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS generation_history (
      id TEXT PRIMARY KEY NOT NULL,
      prompt TEXT NOT NULL,
      provider_json TEXT NOT NULL,
      input_images_json TEXT NOT NULL,
      output_images_json TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export async function addHistoryItem(item: GenerationHistory): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `
      INSERT OR REPLACE INTO generation_history (
        id,
        prompt,
        provider_json,
        input_images_json,
        output_images_json,
        status,
        error_message,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `,
    item.id,
    item.prompt,
    JSON.stringify(item.provider),
    JSON.stringify(item.inputImages),
    JSON.stringify(item.outputImages),
    item.status,
    item.errorMessage ?? null,
    item.createdAt,
  );
}

export async function listHistoryItems(): Promise<GenerationHistory[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<HistoryRow>(
    "SELECT * FROM generation_history ORDER BY created_at DESC;",
  );

  return rows.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    provider: JSON.parse(row.provider_json) as ProviderConfig,
    inputImages: JSON.parse(row.input_images_json) as ImageInput[],
    outputImages: JSON.parse(row.output_images_json) as ImageResult[],
    status: row.status,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
  }));
}

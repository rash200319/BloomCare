import * as SQLite from 'expo-sqlite';
import {
  DirtyVitalsUpdate,
  PatientMiniProfile,
  PendingScreening,
} from '../types';

const DB_NAME = 'bloomcare_sync_go.db';

class PatientCacheService {
  private dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  private getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = SQLite.openDatabaseAsync(DB_NAME);
    }
    return this.dbPromise!;
  }

  async initialize(): Promise<void> {
    const db = await this.getDb();

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS patient_mini_profiles (
        patient_id TEXT PRIMARY KEY NOT NULL,
        patient_name TEXT NOT NULL,
        age INTEGER,
        gestation_weeks INTEGER,
        risk_level TEXT,
        last_screening_at TEXT,
        history_note TEXT,
        assigned_date TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_patient_name
      ON patient_mini_profiles(patient_name);

      CREATE TABLE IF NOT EXISTS patient_stage1_history (
        history_id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dirty_vitals_updates (
        local_id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        vitals_json TEXT NOT NULL,
        risk_score REAL NOT NULL,
        risk_level TEXT NOT NULL,
        recommendations_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_synced INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_dirty_synced
      ON dirty_vitals_updates(is_synced, updated_at);
    `);
  }

  async cacheMorningProfiles(
    profiles: PatientMiniProfile[],
    assignedDate: string
  ): Promise<void> {
    if (profiles.length === 0) {
      return;
    }

    const db = await this.getDb();
    const now = new Date().toISOString();

    for (const profile of profiles) {
      await db.runAsync(
        `
          INSERT OR REPLACE INTO patient_mini_profiles (
            patient_id, patient_name, age, gestation_weeks, risk_level,
            last_screening_at, history_note, assigned_date, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          profile.patient_id,
          profile.patient_name,
          profile.age ?? null,
          profile.gestation_weeks ?? null,
          profile.risk_level ?? null,
          profile.last_screening_at ?? null,
          profile.history_note ?? null,
          assignedDate,
          now,
        ]
      );
    }
  }

  async cachePatientStage1History(
    patientId: string,
    history: PendingScreening[]
  ): Promise<void> {
    const db = await this.getDb();

    for (const item of history) {
      await db.runAsync(
        `
          INSERT OR REPLACE INTO patient_stage1_history (
            history_id, patient_id, payload_json, created_at
          ) VALUES (?, ?, ?, ?)
        `,
        [item.id, patientId, JSON.stringify(item), item.createdAt]
      );
    }
  }

  async searchPatientByName(query: string): Promise<PatientMiniProfile[]> {
    const db = await this.getDb();

    const rows = await db.getAllAsync<{
      patient_id: string;
      patient_name: string;
      age: number | null;
      gestation_weeks: number | null;
      risk_level: 'low' | 'high' | null;
      last_screening_at: string | null;
      history_note: string | null;
    }>(
      `
        SELECT patient_id, patient_name, age, gestation_weeks, risk_level,
               last_screening_at, history_note
        FROM patient_mini_profiles
        WHERE patient_name LIKE ?
        ORDER BY patient_name ASC
        LIMIT 25
      `,
      [`%${query}%`]
    );

    return rows.map((row: {
      patient_id: string;
      patient_name: string;
      age: number | null;
      gestation_weeks: number | null;
      risk_level: 'low' | 'high' | null;
      last_screening_at: string | null;
      history_note: string | null;
    }) => ({
      patient_id: row.patient_id,
      patient_name: row.patient_name,
      age: row.age ?? undefined,
      gestation_weeks: row.gestation_weeks ?? undefined,
      risk_level: row.risk_level ?? undefined,
      last_screening_at: row.last_screening_at ?? undefined,
      history_note: row.history_note ?? undefined,
    }));
  }

  async getPatientHistory(patientId: string): Promise<PendingScreening[]> {
    const db = await this.getDb();

    const rows = await db.getAllAsync<{
      payload_json: string;
    }>(
      `
        SELECT payload_json
        FROM patient_stage1_history
        WHERE patient_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [patientId]
    );

    return rows
      .map((row: { payload_json: string }) => {
        try {
          return JSON.parse(row.payload_json) as PendingScreening;
        } catch {
          return null;
        }
      })
      .filter((item: PendingScreening | null): item is PendingScreening => item !== null);
  }

  async addDirtyVitalsUpdate(
    update: Omit<DirtyVitalsUpdate, 'local_id' | 'is_synced' | 'created_at' | 'updated_at'>
  ): Promise<string> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    await db.runAsync(
      `
        INSERT INTO dirty_vitals_updates (
          local_id, patient_id, patient_name, vitals_json, risk_score,
          risk_level, recommendations_json, created_at, updated_at, is_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      [
        localId,
        update.patient_id,
        update.patient_name,
        JSON.stringify(update.vitals),
        update.risk_score,
        update.risk_level,
        JSON.stringify(update.recommendations),
        now,
        now,
      ]
    );

    return localId;
  }

  async getDirtyUpdates(limit: number = 100): Promise<DirtyVitalsUpdate[]> {
    const db = await this.getDb();

    const rows = await db.getAllAsync<{
      local_id: string;
      patient_id: string;
      patient_name: string;
      vitals_json: string;
      risk_score: number;
      risk_level: 'low' | 'high';
      recommendations_json: string;
      created_at: string;
      updated_at: string;
      is_synced: number;
    }>(
      `
        SELECT local_id, patient_id, patient_name, vitals_json, risk_score,
               risk_level, recommendations_json, created_at, updated_at, is_synced
        FROM dirty_vitals_updates
        WHERE is_synced = 0
        ORDER BY updated_at ASC
        LIMIT ?
      `,
      [limit]
    );

    return rows.map((row: {
      local_id: string;
      patient_id: string;
      patient_name: string;
      vitals_json: string;
      risk_score: number;
      risk_level: 'low' | 'high';
      recommendations_json: string;
      created_at: string;
      updated_at: string;
      is_synced: number;
    }) => ({
      local_id: row.local_id,
      patient_id: row.patient_id,
      patient_name: row.patient_name,
      vitals: JSON.parse(row.vitals_json),
      risk_score: row.risk_score,
      risk_level: row.risk_level,
      recommendations: JSON.parse(row.recommendations_json),
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_synced: row.is_synced === 1,
    }));
  }

  async markDirtyUpdateSynced(localId: string): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `
        UPDATE dirty_vitals_updates
        SET is_synced = 1,
            updated_at = ?
        WHERE local_id = ?
      `,
      [new Date().toISOString(), localId]
    );
  }

  async getDirtyCount(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM dirty_vitals_updates WHERE is_synced = 0`
    );
    return row?.count ?? 0;
  }
}

export default new PatientCacheService();

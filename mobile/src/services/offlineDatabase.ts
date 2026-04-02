import * as SQLite from 'expo-sqlite';
import {
  PatientMiniProfile,
  PendingScreening,
  User,
  UserRole,
  DirtyVitalsUpdate,
} from '../types';

const DB_NAME = 'bloomcare_offline.db';

export interface CachedAppointment {
  appointment_id: string;
  patient_id: string;
  title: string;
  description?: string;
  scheduled_for: string;
  appointment_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CachedInsight {
  insight_id: string;
  patient_id: string;
  title: string;
  content: string;
  insight_type: string;
  created_at: string;
  updated_at: string;
}

export interface CachedScreening {
  screening_id: string;
  patient_id: string;
  vitals_json: string;
  risk_level: string;
  risk_score: number;
  recommendations: string;
  created_at: string;
  updated_at: string;
}

export interface SyncMetadata {
  record_id: string;
  entity_type: string; // 'appointment', 'insight', 'screening', 'vitals'
  operation: string; // 'create', 'update', 'delete'
  payload_json: string;
  created_at: string;
  synced_at?: string;
  sync_status: string; // 'pending', 'synced', 'failed'
}

/**
 * OfflineDatabase Service
 * Manages all offline storage for mobile app
 * Supports both patient and frontline staff workflows
 */
class OfflineDatabase {
  private dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  private getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = SQLite.openDatabaseAsync(DB_NAME);
    }
    return this.dbPromise;
  }

  async initialize(): Promise<void> {
    const db = await this.getDb();

    await db.execAsync(`
      -- User profile cache
      CREATE TABLE IF NOT EXISTS user_profile (
        user_id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        cached_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Patient profiles for frontline staff
      CREATE TABLE IF NOT EXISTS patient_profiles (
        patient_id TEXT PRIMARY KEY NOT NULL,
        national_id TEXT UNIQUE,
        full_name TEXT NOT NULL,
        age INTEGER,
        due_date TEXT,
        contact_number TEXT,
        emergency_contact TEXT,
        blood_group TEXT,
        assigned_worker_id TEXT,
        risk_level TEXT,
        last_screening_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_patient_name
      ON patient_profiles(full_name);

      CREATE INDEX IF NOT EXISTS idx_assigned_worker
      ON patient_profiles(assigned_worker_id);

      -- Appointments
      CREATE TABLE IF NOT EXISTS appointments (
        appointment_id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        scheduled_for TEXT NOT NULL,
        appointment_type TEXT,
        status TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_appt_patient
      ON appointments(patient_id);

      CREATE INDEX IF NOT EXISTS idx_appt_scheduled
      ON appointments(scheduled_for);

      -- Insights/Recommendations
      CREATE TABLE IF NOT EXISTS insights (
        insight_id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        insight_type TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_insight_patient
      ON insights(patient_id);

      -- Screening History
      CREATE TABLE IF NOT EXISTS screening_history (
        screening_id TEXT PRIMARY KEY NOT NULL,
        patient_id TEXT NOT NULL,
        vitals_json TEXT NOT NULL,
        risk_level TEXT,
        risk_score REAL,
        recommendations TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_screening_patient
      ON screening_history(patient_id);

      CREATE INDEX IF NOT EXISTS idx_screening_date
      ON screening_history(created_at);

      -- Pending/Dirty updates for sync
      CREATE TABLE IF NOT EXISTS pending_syncs (
        record_id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        patient_id TEXT,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT,
        sync_status TEXT DEFAULT 'pending'
      );

      CREATE INDEX IF NOT EXISTS idx_pending_status
      ON pending_syncs(sync_status, created_at);

      -- Sync log
      CREATE TABLE IF NOT EXISTS sync_log (
        sync_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        sync_type TEXT,
        synced_records INTEGER,
        synced_at TEXT NOT NULL,
        duration_ms INTEGER,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sync_user
      ON sync_log(user_id, synced_at);
    `);
  }

  // ============= USER PROFILE =============

  async cacheUserProfile(user: User): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT OR REPLACE INTO user_profile
        (user_id, email, full_name, role, is_active, cached_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [user.id, user.email, user.full_name, user.role, user.is_active ? 1 : 0, now, now]
    );
  }

  async getUserProfile(userId: string): Promise<User | null> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<any>(
      'SELECT * FROM user_profile WHERE user_id = ?',
      [userId]
    );

    if (!result) return null;

    return {
      id: result.user_id,
      email: result.email,
      full_name: result.full_name,
      role: result.role as UserRole,
      is_active: result.is_active === 1,
    };
  }

  // ============= PATIENT PROFILES =============

  async cachePatientProfile(patient: PatientMiniProfile & { national_id?: string; contact_number?: string; emergency_contact?: string; blood_group?: string; due_date?: string; assigned_worker_id?: string }): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT OR REPLACE INTO patient_profiles
        (patient_id, national_id, full_name, age, due_date, contact_number, 
         emergency_contact, blood_group, assigned_worker_id, risk_level, 
         last_screening_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        patient.patient_id,
        patient.national_id || null,
        patient.patient_name,
        patient.age || null,
        patient.due_date || null,
        patient.contact_number || null,
        patient.emergency_contact || null,
        patient.blood_group || null,
        patient.assigned_worker_id || null,
        patient.risk_level || 'low',
        patient.last_screening_at || null,
        now,
        now,
      ]
    );
  }

  async cachePatientProfiles(patients: any[]): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    for (const patient of patients) {
      await db.runAsync(
        `
          INSERT OR REPLACE INTO patient_profiles
          (patient_id, national_id, full_name, age, due_date, contact_number, 
           emergency_contact, blood_group, assigned_worker_id, risk_level, 
           last_screening_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          patient.patient_id || patient.id,
          patient.national_id || null,
          patient.patient_name || patient.full_name,
          patient.age || null,
          patient.due_date || null,
          patient.contact_number || null,
          patient.emergency_contact || null,
          patient.blood_group || null,
          patient.assigned_worker_id || null,
          patient.risk_level || 'low',
          patient.last_screening_at || null,
          now,
          now,
        ]
      );
    }
  }

  async getPatientProfile(patientId: string): Promise<any | null> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<any>(
      'SELECT * FROM patient_profiles WHERE patient_id = ?',
      [patientId]
    );
    return result || null;
  }

  async getAllPatientProfiles(): Promise<any[]> {
    const db = await this.getDb();
    return await db.getAllAsync(
      'SELECT * FROM patient_profiles ORDER BY full_name ASC'
    );
  }

  async searchPatients(query: string): Promise<any[]> {
    const db = await this.getDb();
    const searchTerm = `%${query}%`;
    return await db.getAllAsync(
      `
        SELECT * FROM patient_profiles 
        WHERE full_name LIKE ? OR national_id LIKE ? OR contact_number LIKE ?
        ORDER BY full_name ASC
      `,
      [searchTerm, searchTerm, searchTerm]
    );
  }

  // ============= APPOINTMENTS =============

  async cacheAppointment(appt: CachedAppointment): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `
        INSERT OR REPLACE INTO appointments
        (appointment_id, patient_id, title, description, scheduled_for, 
         appointment_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        appt.appointment_id,
        appt.patient_id,
        appt.title,
        appt.description || null,
        appt.scheduled_for,
        appt.appointment_type || null,
        appt.status || 'scheduled',
        appt.created_at,
        appt.updated_at,
      ]
    );
  }

  async cacheAppointments(appointments: CachedAppointment[]): Promise<void> {
    const db = await this.getDb();

    for (const appt of appointments) {
      await db.runAsync(
        `
          INSERT OR REPLACE INTO appointments
          (appointment_id, patient_id, title, description, scheduled_for, 
           appointment_type, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          appt.appointment_id,
          appt.patient_id,
          appt.title,
          appt.description || null,
          appt.scheduled_for,
          appt.appointment_type || null,
          appt.status || 'scheduled',
          appt.created_at,
          appt.updated_at,
        ]
      );
    }
  }

  async getAppointmentsForPatient(patientId: string): Promise<CachedAppointment[]> {
    const db = await this.getDb();
    return await db.getAllAsync(
      `
        SELECT appointment_id, patient_id, title, description, scheduled_for, 
               appointment_type, status, created_at, updated_at
        FROM appointments 
        WHERE patient_id = ? 
        ORDER BY scheduled_for DESC
      `,
      [patientId]
    );
  }

  async getUpcomingAppointments(patientId: string): Promise<CachedAppointment[]> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    return await db.getAllAsync(
      `
        SELECT appointment_id, patient_id, title, description, scheduled_for, 
               appointment_type, status, created_at, updated_at
        FROM appointments 
        WHERE patient_id = ? AND scheduled_for >= ?
        ORDER BY scheduled_for ASC
      `,
      [patientId, now]
    );
  }

  // ============= INSIGHTS =============

  async cacheInsight(insight: CachedInsight): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `
        INSERT OR REPLACE INTO insights
        (insight_id, patient_id, title, content, insight_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        insight.insight_id,
        insight.patient_id,
        insight.title,
        insight.content,
        insight.insight_type || null,
        insight.created_at,
        insight.updated_at,
      ]
    );
  }

  async cacheInsights(insights: CachedInsight[]): Promise<void> {
    const db = await this.getDb();

    for (const insight of insights) {
      await db.runAsync(
        `
          INSERT OR REPLACE INTO insights
          (insight_id, patient_id, title, content, insight_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          insight.insight_id,
          insight.patient_id,
          insight.title,
          insight.content,
          insight.insight_type || null,
          insight.created_at,
          insight.updated_at,
        ]
      );
    }
  }

  async getInsightsForPatient(patientId: string): Promise<CachedInsight[]> {
    const db = await this.getDb();
    return await db.getAllAsync(
      `
        SELECT insight_id, patient_id, title, content, insight_type, created_at, updated_at
        FROM insights 
        WHERE patient_id = ? 
        ORDER BY created_at DESC
      `,
      [patientId]
    );
  }

  // ============= SCREENING HISTORY =============

  async cacheScreening(screening: CachedScreening): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `
        INSERT OR REPLACE INTO screening_history
        (screening_id, patient_id, vitals_json, risk_level, risk_score, 
         recommendations, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        screening.screening_id,
        screening.patient_id,
        screening.vitals_json,
        screening.risk_level || 'low',
        screening.risk_score || 0,
        screening.recommendations || null,
        screening.created_at,
        screening.updated_at,
      ]
    );
  }

  async cacheScreenings(screenings: CachedScreening[]): Promise<void> {
    const db = await this.getDb();

    for (const screening of screenings) {
      await db.runAsync(
        `
          INSERT OR REPLACE INTO screening_history
          (screening_id, patient_id, vitals_json, risk_level, risk_score, 
           recommendations, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          screening.screening_id,
          screening.patient_id,
          screening.vitals_json,
          screening.risk_level || 'low',
          screening.risk_score || 0,
          screening.recommendations || null,
          screening.created_at,
          screening.updated_at,
        ]
      );
    }
  }

  async getScreeningHistory(patientId: string, limit: number = 50): Promise<CachedScreening[]> {
    const db = await this.getDb();
    return await db.getAllAsync(
      `
        SELECT screening_id, patient_id, vitals_json, risk_level, risk_score, 
               recommendations, created_at, updated_at
        FROM screening_history 
        WHERE patient_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `,
      [patientId, limit]
    );
  }

  async getLatestScreening(patientId: string): Promise<CachedScreening | null> {
    const db = await this.getDb();
    return await db.getFirstAsync<CachedScreening>(
      `
        SELECT screening_id, patient_id, vitals_json, risk_level, risk_score, 
               recommendations, created_at, updated_at
        FROM screening_history 
        WHERE patient_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `,
      [patientId]
    );
  }

  // ============= PENDING SYNCS =============

  async addPendingSync(
    entityType: string,
    operation: string,
    patientId: string | null,
    payload: any
  ): Promise<string> {
    const db = await this.getDb();
    const recordId = `${entityType}-${operation}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT INTO pending_syncs
        (record_id, entity_type, operation, patient_id, payload_json, created_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [recordId, entityType, operation, patientId || null, JSON.stringify(payload), now, 'pending']
    );

    return recordId;
  }

  async getPendingSyncs(): Promise<SyncMetadata[]> {
    const db = await this.getDb();
    return await db.getAllAsync<SyncMetadata>(
      `
        SELECT record_id, entity_type, operation, patient_id, payload_json, 
               created_at, synced_at, sync_status
        FROM pending_syncs 
        WHERE sync_status = 'pending'
        ORDER BY created_at ASC
      `
    );
  }

  async markSyncSuccess(recordId: string): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.runAsync(
      `
        UPDATE pending_syncs 
        SET sync_status = 'synced', synced_at = ?
        WHERE record_id = ?
      `,
      [now, recordId]
    );
  }

  async markSyncFailed(recordId: string): Promise<void> {
    const db = await this.getDb();

    await db.runAsync(
      `
        UPDATE pending_syncs 
        SET sync_status = 'failed'
        WHERE record_id = ?
      `,
      [recordId]
    );
  }

  async clearOldSyncLog(daysOld: number = 30): Promise<void> {
    const db = await this.getDb();
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

    await db.runAsync(
      `
        DELETE FROM sync_log 
        WHERE synced_at < ?
      `,
      [cutoffDate]
    );
  }

  async logSync(userId: string, syncType: string, recordCount: number, durationMs: number, error?: string): Promise<void> {
    const db = await this.getDb();
    const syncId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT INTO sync_log
        (sync_id, user_id, sync_type, synced_records, synced_at, duration_ms, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [syncId, userId, syncType, recordCount, now, durationMs, error || null]
    );
  }

  // ============= CLEAR DATA =============

  async clearAllData(): Promise<void> {
    const db = await this.getDb();

    await db.execAsync(`
      DELETE FROM user_profile;
      DELETE FROM patient_profiles;
      DELETE FROM appointments;
      DELETE FROM insights;
      DELETE FROM screening_history;
      DELETE FROM pending_syncs;
    `);
  }

  async clearPatientData(patientId: string): Promise<void> {
    const db = await this.getDb();

    await db.execAsync(`
      DELETE FROM appointments WHERE patient_id = '${patientId}';
      DELETE FROM insights WHERE patient_id = '${patientId}';
      DELETE FROM screening_history WHERE patient_id = '${patientId}';
    `);
  }
}

const offlineDatabase = new OfflineDatabase();
export default offlineDatabase;

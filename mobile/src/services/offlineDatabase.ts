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

      -- Offline credentials (multiple users, unique PIN per device)
      CREATE TABLE IF NOT EXISTS offline_credentials (
        user_id TEXT PRIMARY KEY NOT NULL,
        identifier TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        pin_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_pin_hash
      ON offline_credentials(pin_hash);

      -- Appointment reference data (specializations + specialists)
      CREATE TABLE IF NOT EXISTS appointment_specializations (
        specialization TEXT PRIMARY KEY NOT NULL,
        specialist_count INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS appointment_specialists (
        specialist_id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        phone_number TEXT,
        email TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_specialist_specialization
      ON appointment_specialists(specialization);

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

  async remapPatientId(
    localId: string,
    newId: string,
    updated?: Partial<PatientMiniProfile & {
      national_id?: string;
      contact_number?: string;
      emergency_contact?: string;
      blood_group?: string;
      due_date?: string;
      assigned_worker_id?: string;
      risk_level?: string;
      last_screening_at?: string;
    }>
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    if (!localId || !newId || localId === newId) {
      return;
    }

    const existing = await this.getPatientProfile(localId);
    const merged = {
      patient_id: newId,
      national_id: updated?.national_id ?? existing?.national_id ?? null,
      full_name: updated?.patient_name ?? existing?.full_name ?? 'Unknown Patient',
      age: updated?.age ?? existing?.age ?? null,
      due_date: updated?.due_date ?? existing?.due_date ?? null,
      contact_number: updated?.contact_number ?? existing?.contact_number ?? null,
      emergency_contact: updated?.emergency_contact ?? existing?.emergency_contact ?? null,
      blood_group: updated?.blood_group ?? existing?.blood_group ?? null,
      assigned_worker_id: updated?.assigned_worker_id ?? existing?.assigned_worker_id ?? null,
      risk_level: updated?.risk_level ?? existing?.risk_level ?? 'low',
      last_screening_at: updated?.last_screening_at ?? existing?.last_screening_at ?? null,
    };

    await db.runAsync(
      `
        INSERT OR REPLACE INTO patient_profiles
        (patient_id, national_id, full_name, age, due_date, contact_number,
         emergency_contact, blood_group, assigned_worker_id, risk_level,
         last_screening_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        merged.patient_id,
        merged.national_id,
        merged.full_name,
        merged.age,
        merged.due_date,
        merged.contact_number,
        merged.emergency_contact,
        merged.blood_group,
        merged.assigned_worker_id,
        merged.risk_level,
        merged.last_screening_at,
        now,
        now,
      ]
    );

    await db.runAsync(
      `UPDATE appointments SET patient_id = ? WHERE patient_id = ?`,
      [newId, localId]
    );
    await db.runAsync(
      `UPDATE screening_history SET patient_id = ? WHERE patient_id = ?`,
      [newId, localId]
    );
    await db.runAsync(
      `UPDATE pending_syncs SET patient_id = ? WHERE patient_id = ?`,
      [newId, localId]
    );

    const pendingRows = await db.getAllAsync<{ record_id: string; payload_json: string }>(
      `
        SELECT record_id, payload_json
        FROM pending_syncs
        WHERE sync_status = 'pending'
      `
    );

    for (const row of pendingRows) {
      if (!row.payload_json) continue;
      try {
        const { parseSyncPayload, serializeSyncPayload } = await import('./syncEnvelope');
        const parsed = await parseSyncPayload(row.payload_json);
        if (!parsed?.payload || typeof parsed.payload !== 'object') continue;
        const payload = parsed.payload as Record<string, unknown>;
        if (payload?.patient_id === localId) {
          payload.patient_id = newId;
          await db.runAsync(
            `UPDATE pending_syncs SET payload_json = ? WHERE record_id = ?`,
            [await serializeSyncPayload(payload), row.record_id]
          );
        }
      } catch {
        // Ignore malformed payloads.
      }
    }

    await db.runAsync(
      `DELETE FROM patient_profiles WHERE patient_id = ?`,
      [localId]
    );
  }

  async getAllPatientProfiles(): Promise<any[]> {
    const db = await this.getDb();
    return await db.getAllAsync(
      'SELECT * FROM patient_profiles ORDER BY full_name ASC'
    );
  }

  // ============= APPOINTMENT REFERENCE DATA =============

  async cacheAppointmentSpecializations(
    specializations: { specialization: string; specialist_count?: number }[]
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    for (const item of specializations) {
      if (!item?.specialization) continue;
      await db.runAsync(
        `
          INSERT OR REPLACE INTO appointment_specializations
          (specialization, specialist_count, updated_at)
          VALUES (?, ?, ?)
        `,
        [item.specialization, item.specialist_count ?? 0, now]
      );
    }
  }

  async getAppointmentSpecializations(): Promise<{ specialization: string; specialist_count: number }[]> {
    const db = await this.getDb();
    return await db.getAllAsync(
      `
        SELECT specialization, specialist_count
        FROM appointment_specializations
        ORDER BY specialization ASC
      `
    );
  }

  async cacheAppointmentSpecialists(
    specialists: { id: string; full_name: string; specialization: string; phone_number?: string; email?: string }[]
  ): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    for (const item of specialists) {
      if (!item?.id || !item?.full_name || !item?.specialization) continue;
      await db.runAsync(
        `
          INSERT OR REPLACE INTO appointment_specialists
          (specialist_id, full_name, specialization, phone_number, email, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [item.id, item.full_name, item.specialization, item.phone_number ?? null, item.email ?? null, now]
      );
    }
  }

  async getAppointmentSpecialistsBySpecialization(
    specialization: string
  ): Promise<{ id: string; full_name: string; specialization: string; phone_number?: string; email?: string }[]> {
    const db = await this.getDb();
    return await db.getAllAsync(
      `
        SELECT specialist_id as id, full_name, specialization, phone_number, email
        FROM appointment_specialists
        WHERE specialization = ?
        ORDER BY full_name ASC
      `,
      [specialization]
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

  // ============= OFFLINE CREDENTIALS =============

  async upsertOfflineCredential(params: {
    user_id: string;
    identifier: string;
    full_name: string;
    role: string;
    pin_hash: string;
  }): Promise<void> {
    const db = await this.getDb();
    const now = new Date().toISOString();

    await db.runAsync(
      `
        INSERT OR REPLACE INTO offline_credentials
        (user_id, identifier, full_name, role, pin_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        params.user_id,
        params.identifier,
        params.full_name,
        params.role,
        params.pin_hash,
        now,
        now,
      ]
    );
  }

  async getOfflineCredentialByPinHash(pinHash: string): Promise<{
    user_id: string;
    identifier: string;
    full_name: string;
    role: string;
    pin_hash: string;
  } | null> {
    const db = await this.getDb();
    const result = await db.getFirstAsync<any>(
      `
        SELECT user_id, identifier, full_name, role, pin_hash
        FROM offline_credentials
        WHERE pin_hash = ?
        LIMIT 1
      `,
      [pinHash]
    );
    return result || null;
  }

  async isPinHashInUse(pinHash: string, excludeUserId?: string): Promise<boolean> {
    const db = await this.getDb();
    if (excludeUserId) {
      const row = await db.getFirstAsync<any>(
        `
          SELECT user_id FROM offline_credentials
          WHERE pin_hash = ? AND user_id <> ?
          LIMIT 1
        `,
        [pinHash, excludeUserId]
      );
      return !!row;
    }

    const result = await db.getFirstAsync<any>(
      `
        SELECT user_id FROM offline_credentials
        WHERE pin_hash = ?
        LIMIT 1
      `,
      [pinHash]
    );
    return !!result;
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
    const { serializeSyncPayload } = await import('./syncEnvelope');
    const payloadJson = await serializeSyncPayload(payload);

    await db.runAsync(
      `
        INSERT INTO pending_syncs
        (record_id, entity_type, operation, patient_id, payload_json, created_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [recordId, entityType, operation, patientId || null, payloadJson, now, 'pending']
    );

    return recordId;
  }

  async getPendingSyncs(): Promise<SyncMetadata[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<SyncMetadata>(
      `
        SELECT record_id, entity_type, operation, patient_id, payload_json, 
               created_at, synced_at, sync_status
        FROM pending_syncs 
        WHERE sync_status = 'pending'
        ORDER BY created_at ASC
      `
    );

    const { parseSyncPayload, serializeSyncPayload } = await import('./syncEnvelope');
    const verified: SyncMetadata[] = [];

    for (const row of rows) {
      const parsed = await parseSyncPayload(row.payload_json);
      if (!parsed) {
        // Quarantine tampered / unreadable signed payloads.
        await db.runAsync(
          `UPDATE pending_syncs SET sync_status = 'failed' WHERE record_id = ?`,
          [row.record_id]
        );
        continue;
      }

      // Normalize storage to signed envelope; expose plaintext JSON to sync consumers.
      if (!parsed.signed) {
        try {
          const resigned = await serializeSyncPayload(parsed.payload);
          await db.runAsync(
            `UPDATE pending_syncs SET payload_json = ? WHERE record_id = ?`,
            [resigned, row.record_id]
          );
        } catch {
          // Keep serving plaintext if resign fails.
        }
      }

      verified.push({
        ...row,
        payload_json: JSON.stringify(parsed.payload),
      });
    }

    return verified;
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

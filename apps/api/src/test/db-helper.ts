import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@anchor/database/schema';

/**
 * Test Database Helper
 * Creates in-memory SQLite database for testing with Drizzle ORM
 *
 * Based on Drizzle community best practices (2025):
 * - Real database (not mocks) for integration tests
 * - In-memory for speed and isolation
 * - Same Drizzle ORM API as production
 */

export function createTestDb() {
  // Create in-memory SQLite database
  const sqlite = new Database(':memory:');

  // Initialize Drizzle with schema
  const db = drizzle(sqlite, { schema });

  return { db, sqlite };
}

export function runMigrations(sqlite: Database.Database) {
  // Create tables from schema
  // Using raw SQL for simplicity - in production, use Drizzle migrations

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'family_admin',
      password_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      deleted_at INTEGER,
      email_notifications INTEGER NOT NULL DEFAULT 1,
      sms_notifications INTEGER NOT NULL DEFAULT 0,
      timezone TEXT NOT NULL DEFAULT 'Asia/Singapore',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS care_recipients (
      id TEXT PRIMARY KEY,
      family_admin_id TEXT NOT NULL,
      name TEXT NOT NULL,
      date_of_birth INTEGER,
      gender TEXT,
      condition TEXT,
      location TEXT,
      emergency_contact TEXT,
      photo_url TEXT,
      timezone TEXT NOT NULL DEFAULT 'Asia/Singapore',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (family_admin_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS care_recipient_access (
      id TEXT PRIMARY KEY,
      care_recipient_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      granted_by TEXT,
      granted_at INTEGER NOT NULL,
      revoked_at INTEGER,
      FOREIGN KEY (care_recipient_id) REFERENCES care_recipients(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS caregivers (
      id TEXT PRIMARY KEY,
      care_recipient_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      language TEXT NOT NULL DEFAULT 'en',
      pin_code TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      deactivated_at INTEGER,
      deactivated_by TEXT,
      deactivation_reason TEXT,
      last_pin_reset_at INTEGER,
      last_pin_reset_by TEXT,
      created_at INTEGER NOT NULL,
      created_by TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (care_recipient_id) REFERENCES care_recipients(id) ON DELETE CASCADE,
      FOREIGN KEY (deactivated_by) REFERENCES users(id),
      FOREIGN KEY (last_pin_reset_by) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS care_logs (
      id TEXT PRIMARY KEY,
      care_recipient_id TEXT NOT NULL,
      caregiver_id TEXT,
      log_date INTEGER NOT NULL,
      time_period TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      submitted_at INTEGER,
      invalidated_at INTEGER,
      invalidated_by TEXT,
      invalidation_reason TEXT,

      -- Morning Routine
      wake_time TEXT,
      mood TEXT,
      shower_time TEXT,
      hair_wash INTEGER,

      -- Medications (JSON)
      medications TEXT,

      -- Meals (JSON)
      meals TEXT,

      -- Fluids (JSON)
      fluids TEXT,
      total_fluid_intake INTEGER,

      -- Sleep Tracking (JSON) - Sprint 2 Day 3
      afternoon_rest TEXT,
      night_sleep TEXT,

      -- Vitals
      blood_pressure TEXT,
      pulse_rate INTEGER,
      oxygen_level INTEGER,
      blood_sugar REAL,
      vitals_time TEXT,

      -- Mobility (JSON)
      mobility TEXT,

      -- Toileting (JSON) - Sprint 2 Day 5: Separate tracking
      toileting TEXT,
      bowel_movements TEXT,
      urination TEXT,

      -- PSP-Specific & Fall Risk
      balance_scale INTEGER,
      balance_issues INTEGER,
      walking_pattern TEXT,
      freezing_episodes TEXT,
      eye_movement_problems INTEGER,
      speech_communication_scale INTEGER,
      near_falls TEXT,
      actual_falls TEXT,

      -- Safety & Incidents
      falls TEXT,
      emergency_flag INTEGER NOT NULL DEFAULT 0,
      emergency_note TEXT,

      -- Sprint 1: Unaccompanied Time
      unaccompanied_periods TEXT,
      unaccompanied_time TEXT,
      total_unaccompanied_minutes INTEGER DEFAULT 0,
      unaccompanied_incidents TEXT,

      -- Sprint 1: Safety Checks & Emergency Prep
      safety_checks TEXT,
      emergency_prep TEXT,

      -- Notes
      notes TEXT,

      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,

      FOREIGN KEY (care_recipient_id) REFERENCES care_recipients(id) ON DELETE CASCADE,
      FOREIGN KEY (caregiver_id) REFERENCES caregivers(id) ON DELETE SET NULL,
      FOREIGN KEY (invalidated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS medication_schedules (
      id TEXT PRIMARY KEY,
      care_recipient_id TEXT NOT NULL,
      medication_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      purpose TEXT,
      frequency TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      time_slots TEXT,
      day_restriction TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (care_recipient_id) REFERENCES care_recipients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      care_recipient_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      acknowledged_at INTEGER,
      acknowledged_by TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (care_recipient_id) REFERENCES care_recipients(id) ON DELETE CASCADE,
      FOREIGN KEY (acknowledged_by) REFERENCES users(id)
    );
  `);
}

export function seedTestData(db: any) {
  const now = Date.now();

  // Insert test users
  db.insert(schema.users).values({
    id: 'user-123',
    email: 'admin@test.com',
    name: 'Test Family Admin',
    role: 'family_admin' as const,
    passwordHash: 'mock-hash',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }).run();

  db.insert(schema.users).values({
    id: 'user-456',
    email: 'member@test.com',
    name: 'Test Family Member',
    role: 'family_member' as const,
    passwordHash: 'mock-hash',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }).run();

  // Insert test care recipient
  db.insert(schema.careRecipients).values({
    id: '550e8400-e29b-41d4-a716-446655440000',
    familyAdminId: 'user-123',
    name: 'Test Recipient',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }).run();

  // Insert test caregiver
  // PIN: 123456 (bcrypt hash)
  db.insert(schema.caregivers).values({
    id: '550e8400-e29b-41d4-a716-446655440001',
    careRecipientId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Test Caregiver',
    pinCode: '$2b$10$vSIxBIChOu7R4GFQxZJegOYZlJbQhKL7DxaAwSAfRYXLJBjoaEEJG', // bcrypt hash of '123456'
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }).run();

  // Insert another care recipient for access control tests
  db.insert(schema.careRecipients).values({
    id: 'recipient-999',
    familyAdminId: 'user-123',
    name: 'Other Recipient',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }).run();

  // Insert another caregiver for ownership tests
  db.insert(schema.caregivers).values({
    id: 'caregiver-999',
    careRecipientId: 'recipient-999',
    name: 'Other Caregiver',
    pinCode: 'hashed-pin',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }).run();

  return {
    familyAdminId: 'user-123',
    familyMemberId: 'user-456',
    careRecipientId: '550e8400-e29b-41d4-a716-446655440000',
    caregiverId: '550e8400-e29b-41d4-a716-446655440001',
  };
}

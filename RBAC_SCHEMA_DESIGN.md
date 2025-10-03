# RBAC Schema Design & Draft/Submit Workflow

## Overview

Complete role-based access control (RBAC) system with draft/submit workflow for care logs.

**Date**: 2025-10-03
**Migration**: `0001_add_rbac_and_draft_submit.sql`

---

## 1. User Roles & Permissions

### Role Hierarchy

```
┌─────────────────────────────────────────┐
│         family_admin (Account Owner)     │
│  - Full control over care recipient     │
│  - Manage caregivers (CRUD, PIN reset)  │
│  - Invite/remove family members          │
│  - View all data & analytics             │
│  - Export reports                        │
│  - Delete account                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      family_member (Co-viewer)          │
│  - Read-only access to care data        │
│  - View dashboard & trends               │
│  - Receive alerts/notifications          │
│  - Cannot edit caregivers or data        │
│  - Can edit own profile only             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│         caregiver (Form Submitter)       │
│  - Submit daily care logs                │
│  - Draft/Submit workflow                 │
│  - Cannot view family members            │
│  - Cannot delete logs                    │
│  - Can edit own profile (name, phone)   │
└─────────────────────────────────────────┘
```

---

## 2. Schema Changes

### 2.1 `users` Table Updates

**New Fields**:
```sql
role TEXT NOT NULL DEFAULT 'family_admin'
  CHECK(role IN ('family_admin', 'family_member'))

-- Account status
active INTEGER DEFAULT 1 NOT NULL
deleted_at INTEGER  -- Soft delete timestamp

-- Notification preferences
email_notifications INTEGER DEFAULT 1 NOT NULL
sms_notifications INTEGER DEFAULT 0 NOT NULL

-- Timezone (IANA timezone string)
timezone TEXT DEFAULT 'Asia/Singapore' NOT NULL
```

**Migration**: Existing `family` and `admin` roles → `family_admin`

---

### 2.2 `care_recipients` Table Updates

**Renamed Field**:
```sql
family_id → family_admin_id  -- More explicit ownership
```

**New Fields**:
```sql
timezone TEXT DEFAULT 'Asia/Singapore' NOT NULL
  -- Timezone for care recipient (may differ from family admin if in different location)
```

---

### 2.3 `care_recipient_access` Table (New)

**Purpose**: Junction table tracking which `family_member` users have access to which care recipients.

```sql
CREATE TABLE care_recipient_access (
  id TEXT PRIMARY KEY,
  care_recipient_id TEXT NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,  -- family_admin who granted access
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER  -- Soft revoke (NULL = active, timestamp = revoked)
);
```

**Access Logic**:
- `family_admin`: Implicit access (owner via `care_recipients.family_admin_id`)
- `family_member`: Explicit grant required via this table

---

### 2.4 `caregivers` Table Updates

**New Fields**:
```sql
email TEXT  -- Optional email for caregiver

-- Deactivation tracking
deactivated_at INTEGER
deactivated_by TEXT REFERENCES users(id)  -- family_admin who deactivated
deactivation_reason TEXT

-- PIN reset audit trail
last_pin_reset_at INTEGER
last_pin_reset_by TEXT REFERENCES users(id)  -- family_admin who reset PIN

-- Creation tracking
created_by TEXT REFERENCES users(id)  -- family_admin who created caregiver
```

**Admin Actions Tracked**:
1. Caregiver creation → `created_by`, `created_at`
2. PIN reset → `last_pin_reset_at`, `last_pin_reset_by`
3. Deactivation → `deactivated_at`, `deactivated_by`, `deactivation_reason`

---

### 2.5 `care_logs` Table Updates (Draft/Submit Workflow)

**New Fields**:
```sql
status TEXT DEFAULT 'draft' NOT NULL
  CHECK(status IN ('draft', 'submitted', 'invalidated'))

submitted_at INTEGER
invalidated_at INTEGER
invalidated_by TEXT REFERENCES users(id)  -- family_admin who invalidated
invalidation_reason TEXT
```

**Status Workflow**:

```
┌─────────┐
│  draft  │ ← Caregiver creates log, auto-saves every 30s
└────┬────┘
     │ Caregiver clicks "Submit"
     ▼
┌───────────┐
│ submitted │ ← Locked (immutable), visible to family
└─────┬─────┘
      │ family_admin finds error, clicks "Invalidate"
      ▼
┌──────────────┐
│ invalidated  │ ← Flagged for correction, caregiver can create new log
└──────────────┘
```

**Rules**:
- **Draft**: Editable by caregiver, NOT visible to family
- **Submitted**: Locked (immutable), visible to family, counts in analytics
- **Invalidated**: Flagged by family_admin, excluded from analytics

---

## 3. Permissions Matrix

### Operations by Role

| Operation | family_admin | family_member | caregiver |
|-----------|--------------|---------------|-----------|
| **Care Recipients** | | | |
| Create care recipient | ✅ | ❌ | ❌ |
| Edit care recipient | ✅ | ❌ | ❌ |
| Delete care recipient | ✅ | ❌ | ❌ |
| View care recipient | ✅ | ✅ (if granted) | ✅ (assigned) |
| **Caregivers** | | | |
| Create caregiver | ✅ | ❌ | ❌ |
| Edit caregiver (name, phone) | ✅ | ❌ | ✅ (self) |
| Deactivate caregiver | ✅ | ❌ | ❌ |
| Delete caregiver | ✅ | ❌ | ❌ |
| Reset PIN | ✅ | ❌ | ❌ |
| View caregivers | ✅ | ✅ (names only) | ❌ (only self) |
| **Care Logs** | | | |
| Create draft | ❌ | ❌ | ✅ |
| Edit draft | ❌ | ❌ | ✅ (own) |
| Submit draft | ❌ | ❌ | ✅ (own) |
| View submitted logs | ✅ | ✅ (if granted) | ❌ |
| Invalidate log | ✅ | ❌ | ❌ |
| Delete log | ✅ | ❌ | ❌ |
| **Family Members** | | | |
| Invite family member | ✅ | ❌ | ❌ |
| Revoke access | ✅ | ❌ | ❌ |
| Edit own profile | ✅ | ✅ | ✅ |
| View dashboard | ✅ | ✅ (if granted) | ❌ |
| Export reports | ✅ | ✅ (if granted) | ❌ |
| **Account** | | | |
| Delete account | ✅ | ❌ | ❌ |
| Change billing | ✅ | ❌ | ❌ |

---

## 4. Timezone Handling

### Timezone Fields

1. **`users.timezone`**: User's preferred timezone for viewing data
2. **`care_recipients.timezone`**: Timezone where care recipient lives (for accurate log timestamps)

### Use Cases

**Scenario 1: Family in different timezone**
- Care recipient: Singapore (`Asia/Singapore`)
- Family admin: New York (`America/New_York`)
- Care log submitted at 8:00 AM Singapore time
- Family admin sees "8:00 AM SGT" or "7:00 PM EST (previous day)"

**Scenario 2: Multiple family members in different locations**
- Care recipient: Singapore
- Family admin: Singapore
- Family member: London (`Europe/London`)
- Each user sees times converted to their own timezone

### Implementation

```typescript
// When displaying care log to family
const careRecipientTz = careRecipient.timezone; // 'Asia/Singapore'
const userTz = user.timezone; // 'America/New_York'

const logTime = new Date(careLog.submittedAt);

// Show in care recipient's timezone (source of truth)
const displayTime = formatInTimeZone(logTime, careRecipientTz, 'PPpp');
// "Oct 3, 2025, 8:00 AM"

// Also show in user's timezone
const userTime = formatInTimeZone(logTime, userTz, 'PPpp');
// "Oct 2, 2025, 7:00 PM"
```

---

## 5. Row-Level Security (RLS) Logic

### Access Check Queries

#### Can user access care recipient?

```typescript
async function canAccessCareRecipient(userId: string, careRecipientId: string): Promise<boolean> {
  // Check if user is the family_admin (owner)
  const isOwner = await db
    .select()
    .from(careRecipients)
    .where(and(
      eq(careRecipients.id, careRecipientId),
      eq(careRecipients.familyAdminId, userId)
    ))
    .get();

  if (isOwner) return true;

  // Check if user has explicit access (family_member)
  const hasAccess = await db
    .select()
    .from(careRecipientAccess)
    .where(and(
      eq(careRecipientAccess.careRecipientId, careRecipientId),
      eq(careRecipientAccess.userId, userId),
      isNull(careRecipientAccess.revokedAt)
    ))
    .get();

  return !!hasAccess;
}
```

#### Can user manage caregivers?

```typescript
async function canManageCaregivers(userId: string, careRecipientId: string): Promise<boolean> {
  // Only family_admin can manage caregivers
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (user.role !== 'family_admin') return false;

  // Must be the owner of the care recipient
  return canAccessCareRecipient(userId, careRecipientId);
}
```

#### Can user invalidate care log?

```typescript
async function canInvalidateCareLog(userId: string, careLogId: string): Promise<boolean> {
  // Only family_admin can invalidate
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (user.role !== 'family_admin') return false;

  // Must own the care recipient
  const careLog = await db
    .select({ careRecipientId: careLogs.careRecipientId })
    .from(careLogs)
    .where(eq(careLogs.id, careLogId))
    .get();

  return canAccessCareRecipient(userId, careLog.careRecipientId);
}
```

---

## 6. Draft/Submit Workflow Details

### Auto-Save Behavior

```typescript
// Frontend: Auto-save draft every 30s
useEffect(() => {
  const interval = setInterval(async () => {
    if (formData.status === 'draft') {
      await fetch(`/api/care-logs/${logId}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...formData, status: 'draft' })
      });
    }
  }, 30000); // 30 seconds

  return () => clearInterval(interval);
}, [formData]);
```

### Submit Action

```typescript
// Frontend: Submit button
const handleSubmit = async () => {
  const response = await fetch(`/api/care-logs/${logId}/submit`, {
    method: 'POST'
  });

  if (response.ok) {
    // Show success message
    // Redirect to caregiver home
  }
};

// Backend: Submit endpoint
app.post('/api/care-logs/:id/submit', async (c) => {
  const logId = c.req.param('id');
  const caregiverId = c.get('caregiverId'); // From auth middleware

  // Verify caregiver owns this log
  const log = await db.select().from(careLogs).where(eq(careLogs.id, logId)).get();
  if (log.caregiverId !== caregiverId) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // Can only submit drafts
  if (log.status !== 'draft') {
    return c.json({ error: 'Log already submitted' }, 400);
  }

  // Mark as submitted (immutable)
  await db
    .update(careLogs)
    .set({
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(careLogs.id, logId));

  return c.json({ success: true });
});
```

### Invalidate Action (Family Admin Only)

```typescript
// Frontend: Invalidate button
const handleInvalidate = async (logId: string, reason: string) => {
  const response = await fetch(`/api/care-logs/${logId}/invalidate`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });

  if (response.ok) {
    // Notify caregiver
    // Update UI
  }
};

// Backend: Invalidate endpoint
app.post('/api/care-logs/:id/invalidate', requireFamilyAdmin, async (c) => {
  const logId = c.req.param('id');
  const userId = c.get('userId');
  const { reason } = await c.req.json();

  // Can only invalidate submitted logs
  const log = await db.select().from(careLogs).where(eq(careLogs.id, logId)).get();
  if (log.status !== 'submitted') {
    return c.json({ error: 'Can only invalidate submitted logs' }, 400);
  }

  // Mark as invalidated
  await db
    .update(careLogs)
    .set({
      status: 'invalidated',
      invalidatedAt: new Date(),
      invalidatedBy: userId,
      invalidationReason: reason,
      updatedAt: new Date()
    })
    .where(eq(careLogs.id, logId));

  // TODO: Send notification to caregiver

  return c.json({ success: true });
});
```

---

## 7. Migration Notes

### Data Migration

```sql
-- Existing users with role 'family' or 'admin' → 'family_admin'
UPDATE users SET role = 'family_admin' WHERE role IN ('family', 'admin');

-- Existing care_logs → mark as 'submitted' (already finalized)
UPDATE care_logs
SET status = 'submitted', submitted_at = created_at
WHERE status = 'draft';
```

### Indexes for Performance

```sql
CREATE INDEX idx_care_recipient_access_care_recipient ON care_recipient_access(care_recipient_id);
CREATE INDEX idx_care_recipient_access_user ON care_recipient_access(user_id);
CREATE INDEX idx_care_logs_status ON care_logs(status);
CREATE INDEX idx_care_logs_submitted_at ON care_logs(submitted_at);
CREATE INDEX idx_caregivers_active ON caregivers(active);
CREATE INDEX idx_users_active ON users(active);
```

---

## 8. Next Steps

### Immediate
1. ✅ Schema design completed
2. ✅ Migration file created
3. ⏳ Apply migration to local database
4. ⏳ Implement RBAC middleware (Hono)
5. ⏳ Create Admin Settings UI
6. ⏳ Update frontend auth flow

### Future Enhancements
1. **Audit Log Table**: Track all admin actions (caregiver edits, access grants, invalidations)
2. **Super Admin Role**: Platform-level administration (post-MVP)
3. **Temporary Access**: Grant time-limited access to family members
4. **Notification System**: Email/SMS alerts for invalidated logs, new invites
5. **Caregiver Performance**: Track submission times, compliance rates

---

## Files Modified

- `packages/database/src/schema.ts` (updated with all new fields)
- `packages/database/drizzle/migrations/0001_add_rbac_and_draft_submit.sql` (new migration)

---

**Last Updated**: 2025-10-03
**Status**: Schema complete, ready for middleware implementation

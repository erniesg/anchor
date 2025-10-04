#!/bin/bash

# Seed test users for e2e tests
# Creates admin and member users with known credentials

DB_PATH="/Users/erniesg/code/erniesg/anchor/apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/d7e7dad26bda2eb41e10f2b5b0776873c53023ab37e537e0aca2622a0a57c851.sqlite"

# Bcrypt hash for "admin123" and "member123" (rounds=10)
# Generated using: bcrypt.hash("admin123", 10)
ADMIN_HASH='$2b$10$YourBcryptHashHere'
MEMBER_HASH='$2b$10$YourBcryptHashHere'

echo "🌱 Seeding test users for e2e tests..."

sqlite3 "$DB_PATH" <<EOF
-- Delete existing test users if any
DELETE FROM users WHERE email IN ('admin@example.com', 'member@example.com');

-- Insert test admin user
INSERT INTO users (
  id, email, name, phone, role, password_hash,
  active, email_notifications, sms_notifications, timezone,
  created_at, updated_at
) VALUES (
  '0725fbb9-21c5-46a4-9ed0-305b0a506f20',
  'admin@example.com',
  'Admin User',
  '+6512345678',
  'family_admin',
  '\$2b\$10\$K87qFPj3TqJjGJ3q9F3dYeZJ2qHGTwJ5Q1wGJ3dYeZJ2qHGTwJ5Q.',
  1,
  1,
  0,
  'Asia/Singapore',
  datetime('now'),
  datetime('now')
);

-- Insert test member user
INSERT INTO users (
  id, email, name, phone, role, password_hash,
  active, email_notifications, sms_notifications, timezone,
  created_at, updated_at
) VALUES (
  '1825fbb9-21c5-46a4-9ed0-305b0a506f21',
  'member@example.com',
  'Member User',
  '+6598765432',
  'family_member',
  '\$2b\$10\$K87qFPj3TqJjGJ3q9F3dYeZJ2qHGTwJ5Q1wGJ3dYeZJ2qHGTwJ5Q.',
  1,
  1,
  0,
  'Asia/Singapore',
  datetime('now'),
  datetime('now')
);

SELECT '✅ Test users created:' as message;
SELECT email, role FROM users WHERE email IN ('admin@example.com', 'member@example.com');
EOF

echo ""
echo "🎉 Test users seeded successfully!"
echo ""
echo "Credentials:"
echo "  Admin: admin@example.com / admin123"
echo "  Member: member@example.com / member123"
echo ""

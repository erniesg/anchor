-- Migration: 0004_fall_risk_assessment.sql
-- Sprint 1: Fall Risk & Safety Features
-- Created: 2025-10-06

-- Fall Risk Assessment Fields
ALTER TABLE care_logs ADD COLUMN balance_issues INTEGER CHECK(balance_issues BETWEEN 1 AND 5);
ALTER TABLE care_logs ADD COLUMN near_falls TEXT CHECK(near_falls IN ('none', 'once_or_twice', 'multiple'));
ALTER TABLE care_logs ADD COLUMN actual_falls TEXT CHECK(actual_falls IN ('none', 'minor', 'major'));
-- walking_pattern already exists
-- freezing_episodes already exists

-- Unaccompanied Time Tracking
ALTER TABLE care_logs ADD COLUMN unaccompanied_time TEXT; -- JSON array
ALTER TABLE care_logs ADD COLUMN unaccompanied_incidents TEXT; -- Incident report

-- Safety Checks & Emergency Preparedness
ALTER TABLE care_logs ADD COLUMN safety_checks TEXT; -- JSON object
ALTER TABLE care_logs ADD COLUMN emergency_prep TEXT; -- JSON object

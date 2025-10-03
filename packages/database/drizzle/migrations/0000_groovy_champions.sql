CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`care_recipient_id` text NOT NULL,
	`alert_type` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`acknowledged` integer DEFAULT false NOT NULL,
	`acknowledged_at` integer,
	`acknowledged_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`care_recipient_id`) REFERENCES `care_recipients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `care_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`care_recipient_id` text NOT NULL,
	`caregiver_id` text,
	`log_date` integer NOT NULL,
	`time_period` text,
	`wake_time` text,
	`mood` text,
	`shower_time` text,
	`hair_wash` integer,
	`medications` text,
	`meals` text,
	`fluids` text,
	`total_fluid_intake` integer,
	`blood_pressure` text,
	`pulse_rate` integer,
	`oxygen_level` integer,
	`blood_sugar` real,
	`vitals_time` text,
	`mobility` text,
	`toileting` text,
	`balance_scale` integer,
	`walking_pattern` text,
	`freezing_episodes` text,
	`eye_movement_problems` integer,
	`speech_communication_scale` integer,
	`falls` text,
	`emergency_flag` integer DEFAULT false NOT NULL,
	`emergency_note` text,
	`unaccompanied_periods` text,
	`total_unaccompanied_minutes` integer DEFAULT 0,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`care_recipient_id`) REFERENCES `care_recipients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`caregiver_id`) REFERENCES `caregivers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `care_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`date_of_birth` integer,
	`condition` text,
	`location` text,
	`emergency_contact` text,
	`photo_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `caregivers` (
	`id` text PRIMARY KEY NOT NULL,
	`care_recipient_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`language` text DEFAULT 'en' NOT NULL,
	`pin_code` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`care_recipient_id`) REFERENCES `care_recipients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `medication_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`care_recipient_id` text NOT NULL,
	`medication_name` text NOT NULL,
	`dosage` text NOT NULL,
	`purpose` text,
	`frequency` text NOT NULL,
	`time_slot` text NOT NULL,
	`time_slots` text,
	`day_restriction` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`care_recipient_id`) REFERENCES `care_recipients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`role` text DEFAULT 'family' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
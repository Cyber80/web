-- 1. Core: โรงเรียน (Schools)
CREATE TABLE IF NOT EXISTS `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL UNIQUE,
	`address` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- 2. Core: ผู้ใช้งาน (Users)
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text REFERENCES `schools`(`id`),
	`google_id` text UNIQUE,
	`email` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`role` text DEFAULT 'GUEST' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- 3. Unified Data Sharing Engine Table (คลังแชร์ข้อมูลกลาง)
CREATE TABLE IF NOT EXISTS `shared_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_school_id` text NOT NULL REFERENCES `schools`(`id`),
	`created_by_user_id` text NOT NULL REFERENCES `users`(`id`),
	`module_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`file_r2_key` text,
	`visibility` text DEFAULT 'SCHOOL_INTERNAL' NOT NULL,
	`tags` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);

-- 4. Network Sharing Permission (สิทธิ์แชร์เครือข่ายโรงเรียน)
CREATE TABLE IF NOT EXISTS `resource_access_list` (
	`resource_id` text NOT NULL REFERENCES `shared_resources`(`id`),
	`target_school_id` text NOT NULL REFERENCES `schools`(`id`),
	`granted_at` text DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`resource_id`, `target_school_id`)
);

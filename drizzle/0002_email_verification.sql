CREATE TABLE IF NOT EXISTS `registration_verifications` (
  `email` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `employee_code` text NOT NULL,
  `password_hash` text NOT NULL,
  `password_salt` text NOT NULL,
  `code_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `last_sent_at` text NOT NULL,
  `created_at` text NOT NULL
);

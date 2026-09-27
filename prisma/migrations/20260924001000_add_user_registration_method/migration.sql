CREATE TYPE "RegistrationMethod" AS ENUM ('EMAIL', 'GOOGLE', 'UNKNOWN');

ALTER TABLE "users"
  ADD COLUMN "registration_method" "RegistrationMethod" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "users"
SET "registration_method" = CASE
  WHEN "google_sub" IS NOT NULL AND "password_hash" IS NULL THEN 'GOOGLE'::"RegistrationMethod"
  WHEN "password_hash" IS NOT NULL AND "google_sub" IS NULL THEN 'EMAIL'::"RegistrationMethod"
  ELSE 'UNKNOWN'::"RegistrationMethod"
END;

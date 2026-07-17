ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

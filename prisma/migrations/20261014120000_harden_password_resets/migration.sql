DO $$
BEGIN
  IF to_regclass('public.password_reset_tokens') IS NULL THEN
    RAISE EXCEPTION 'password_reset_tokens must exist before applying password reset hardening';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_tokens'
      AND column_name = 'token'
  ) THEN
    RAISE EXCEPTION 'password_reset_tokens.token must exist before applying password reset hardening';
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "password_reset_tokens" RENAME COLUMN "token" TO "token_hash";
ALTER TABLE "password_reset_tokens" ADD COLUMN "request_bucket" TIMESTAMP(3);
CREATE UNIQUE INDEX "password_reset_tokens_user_request_bucket_key"
  ON "password_reset_tokens"("user_id", "request_bucket");
CREATE INDEX "idx_password_reset_tokens_user_created_at"
  ON "password_reset_tokens"("user_id", "created_at");

CREATE TABLE "blog_posts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "hero_image" TEXT,
  "accent" TEXT NOT NULL DEFAULT 'amber',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "title_vi" TEXT NOT NULL,
  "title_en" TEXT,
  "excerpt_vi" TEXT NOT NULL,
  "excerpt_en" TEXT,
  "category_vi" TEXT NOT NULL,
  "category_en" TEXT,
  "read_time_vi" TEXT,
  "read_time_en" TEXT,
  "author" TEXT NOT NULL DEFAULT 'Cafe Maps Editorial',
  "mood_vi" TEXT,
  "mood_en" TEXT,
  "location_vi" TEXT,
  "location_en" TEXT,
  "hero_image_alt_vi" TEXT,
  "hero_image_alt_en" TEXT,
  "intro_vi" TEXT,
  "intro_en" TEXT,
  "pull_quote_vi" TEXT,
  "pull_quote_en" TEXT,
  "sections_vi" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sections_en" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "checklist_vi" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "checklist_en" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_featured" BOOLEAN NOT NULL DEFAULT false,
  "featured_order" INTEGER,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");
CREATE INDEX "idx_blog_posts_published" ON "blog_posts"("is_published", "published_at");
CREATE INDEX "idx_blog_posts_featured" ON "blog_posts"("is_featured", "featured_order");
CREATE INDEX "idx_blog_posts_tags" ON "blog_posts" USING GIN ("tags");

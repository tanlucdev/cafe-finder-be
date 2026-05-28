type BlogLocale = 'vi' | 'en';

type BlogPostRecord = {
  id: string;
  slug: string;
  heroImage: string | null;
  accent: string;
  tags: string[];
  titleVi: string;
  titleEn: string | null;
  excerptVi: string;
  excerptEn: string | null;
  categoryVi: string;
  categoryEn: string | null;
  readTimeVi: string | null;
  readTimeEn: string | null;
  author: string;
  moodVi: string | null;
  moodEn: string | null;
  locationVi: string | null;
  locationEn: string | null;
  heroImageAltVi: string | null;
  heroImageAltEn: string | null;
  introVi: string | null;
  introEn: string | null;
  pullQuoteVi: string | null;
  pullQuoteEn: string | null;
  sectionsVi: unknown;
  sectionsEn: unknown;
  checklistVi: string[];
  checklistEn: string[];
  isFeatured: boolean;
  featuredOrder: number | null;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BlogSection = {
  heading: string;
  body: string;
};

export function normalizeBlogLocale(locale?: string): BlogLocale {
  return locale === 'en' ? 'en' : 'vi';
}

function pickLocalized(
  post: BlogPostRecord,
  locale: BlogLocale,
  viKey: keyof BlogPostRecord,
  enKey: keyof BlogPostRecord,
) {
  const primary = locale === 'en' ? post[enKey] : post[viKey];
  const fallback = locale === 'en' ? post[viKey] : post[enKey];
  return (primary || fallback || '') as string;
}

function normalizeSections(value: unknown): BlogSection[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((section) => {
      if (!section || typeof section !== 'object') return null;
      const candidate = section as Record<string, unknown>;
      const heading = typeof candidate.heading === 'string' ? candidate.heading.trim() : '';
      const body = typeof candidate.body === 'string' ? candidate.body.trim() : '';
      return heading && body ? { heading, body } : null;
    })
    .filter((section): section is BlogSection => Boolean(section));
}

function formatDateLabel(value: Date | null, fallback: Date, locale: BlogLocale) {
  const date = value ?? fallback;
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function serializeLocalizedBlogPost(post: BlogPostRecord, locale?: string) {
  const normalizedLocale = normalizeBlogLocale(locale);
  const viSections = normalizeSections(post.sectionsVi);
  const enSections = normalizeSections(post.sectionsEn);
  const sections = normalizedLocale === 'en' && enSections.length ? enSections : viSections;
  const checklist =
    normalizedLocale === 'en' && post.checklistEn.length ? post.checklistEn : post.checklistVi;

  return {
    id: post.id,
    slug: post.slug,
    heroImage: post.heroImage,
    accent: post.accent,
    tags: post.tags,
    title: pickLocalized(post, normalizedLocale, 'titleVi', 'titleEn'),
    excerpt: pickLocalized(post, normalizedLocale, 'excerptVi', 'excerptEn'),
    category: pickLocalized(post, normalizedLocale, 'categoryVi', 'categoryEn'),
    dateLabel: formatDateLabel(post.publishedAt, post.createdAt, normalizedLocale),
    readTime: pickLocalized(post, normalizedLocale, 'readTimeVi', 'readTimeEn'),
    author: post.author,
    mood: pickLocalized(post, normalizedLocale, 'moodVi', 'moodEn'),
    location: pickLocalized(post, normalizedLocale, 'locationVi', 'locationEn'),
    heroImageAlt: pickLocalized(post, normalizedLocale, 'heroImageAltVi', 'heroImageAltEn'),
    intro: pickLocalized(post, normalizedLocale, 'introVi', 'introEn'),
    pullQuote: pickLocalized(post, normalizedLocale, 'pullQuoteVi', 'pullQuoteEn'),
    sections,
    checklist,
    isFeatured: post.isFeatured,
    featuredOrder: post.featuredOrder,
    isPublished: post.isPublished,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

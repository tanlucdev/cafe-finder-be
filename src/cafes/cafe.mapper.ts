export type CafeLocale = 'vi' | 'en';

type LocalizedCafeRecord = Record<string, any>;

const LOCALIZED_FIELDS = [
  ['name', 'nameEn'],
  ['address', 'addressEn'],
  ['district', 'districtEn'],
  ['oneLiner', 'oneLinerEn'],
  ['description', 'descriptionEn'],
  ['signatureDrink', 'signatureDrinkEn'],
  ['vibes', 'vibesEn'],
  ['purposes', 'purposesEn'],
  ['amenities', 'amenitiesEn'],
  ['tags', 'tagsEn'],
  ['parkingLocation', 'parkingLocationEn'],
] as const;

export function normalizeCafeLocale(locale?: string): CafeLocale {
  return locale === 'en' ? 'en' : 'vi';
}

function pickLocalized<T extends LocalizedCafeRecord>(
  cafe: T,
  locale: CafeLocale,
  viKey: string,
  enKey: string,
) {
  const primary = locale === 'en' ? cafe[enKey] : cafe[viKey];
  const fallback = locale === 'en' ? cafe[viKey] : cafe[enKey];
  if (Array.isArray(primary) || Array.isArray(fallback)) {
    return dedupeLocalizedList(Array.isArray(primary) && primary.length ? primary : fallback || []);
  }
  return primary || fallback || null;
}

function dedupeLocalizedList(values: unknown[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (typeof value !== 'string') return true;
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function serializeLocalizedCafe<T extends LocalizedCafeRecord>(cafe: T, locale?: string) {
  const normalizedLocale = normalizeCafeLocale(locale);
  const data: LocalizedCafeRecord = { ...cafe };

  for (const [viKey, enKey] of LOCALIZED_FIELDS) {
    if (viKey in cafe || enKey in cafe) {
      data[viKey] = pickLocalized(cafe, normalizedLocale, viKey, enKey);
    }
    delete data[enKey];
  }

  return data as Omit<T, (typeof LOCALIZED_FIELDS)[number][1]>;
}

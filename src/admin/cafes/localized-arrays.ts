const ARRAY_TRANSLATIONS = {
  vibes: {
    'yên tĩnh': 'quiet',
    'hiện đại': 'modern',
    'thiên nhiên': 'nature',
    'nhộn nhịp': 'lively',
    'lãng mạn': 'romantic',
    'chill một mình': 'solo chill',
    'sáng tạo': 'creative',
    'ấm cúng': 'cozy',
    'học tập': 'study',
    'làm việc': 'work',
  },
  purposes: {
    'làm việc': 'work',
    'học tập': 'study',
    'đọc sách': 'reading',
    'hẹn hò': 'date',
    'gặp bạn bè': 'friends',
    'chụp ảnh': 'photo spot',
    'chill một mình': 'solo chill',
  },
  amenities: {
    'ổ cắm': 'Power outlets',
    'thú cưng': 'Pet-friendly',
    'chỗ đậu xe': 'Parking',
    'không wifi': 'No WiFi',
    'sân thượng': 'Rooftop',
    'không gian riêng': 'Private space',
    'dã ngoại': 'Picnic',
  },
  tags: {
    'ngoài trời': 'outdoor',
    'hút thuốc': 'smoking',
    'trong nhà': 'indoor',
    'máy lạnh': 'air-conditioned',
    'sân vườn': 'garden',
    'view đẹp': 'nice view',
    'mở khuya': 'late night',
    'mang đi': 'takeaway',
  },
} as const;

const ARRAY_PAIRS = [
  ['vibes', 'vibesEn'],
  ['purposes', 'purposesEn'],
  ['amenities', 'amenitiesEn'],
  ['tags', 'tagsEn'],
] as const;

function mapLocalizedArray(key: keyof typeof ARRAY_TRANSLATIONS, values: unknown) {
  if (!Array.isArray(values)) return values;
  const map = ARRAY_TRANSLATIONS[key] as Record<string, string>;

  return values.map((value) => {
    if (typeof value !== 'string') return value;
    return map[value.trim().toLowerCase()] ?? value;
  });
}

export function syncLocalizedArrays<T extends object>(data: T) {
  const mutable = data as Record<string, any>;

  for (const [primaryKey, localizedKey] of ARRAY_PAIRS) {
    const localized = mutable[localizedKey];
    if (primaryKey in mutable && (!Array.isArray(localized) || localized.length === 0)) {
      mutable[localizedKey] = mapLocalizedArray(primaryKey, mutable[primaryKey]);
    }
  }

  return data;
}

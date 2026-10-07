export const supportedLanguages = ['pt-BR', 'en', 'es'] as const;
export type Language = typeof supportedLanguages[number];
export type LanguagePreference = Language | 'system';

export function checkedPreference(value: unknown): LanguagePreference {
  return value === 'system' || supportedLanguages.some(language => language === value)
    ? value as LanguagePreference : 'system';
}

/** Prefer the first supported device language, rather than a later arbitrary fallback. */
export function resolveLanguage(preference: LanguagePreference, deviceTags: readonly string[]): Language {
  if (preference !== 'system') return preference;
  for (const tag of deviceTags) {
    const base = tag.replace(/_/g, '-').split('-')[0].toLowerCase();
    if (base === 'pt') return 'pt-BR';
    if (base === 'en' || base === 'es') return base;
  }
  return 'en';
}

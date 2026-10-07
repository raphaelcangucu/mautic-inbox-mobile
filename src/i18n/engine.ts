import {createInstance, type TOptions} from 'i18next';
import {resources} from './catalogues.ts';
import type {Language} from './language.ts';

type CatalogueKey = keyof typeof resources['pt-BR']['translation'];
type PluralBase<Key> = Key extends `${infer Base}_one` ? Base : never;
export type TranslationKey = CatalogueKey | PluralBase<CatalogueKey>;
export const i18n = createInstance();
// All dictionaries ship with the app. Locale changes never download user content.
void i18n.init({resources, lng:'pt-BR', fallbackLng:'pt-BR',
  supportedLngs:['pt-BR','en','es'], load:'currentOnly', initAsync:false,
  keySeparator:false, nsSeparator:false, interpolation:{escapeValue:false},
  returnNull:false, returnEmptyString:false});

export function t(key: TranslationKey, options?: TOptions): string {
  return String(i18n.t(key, options));
}
export function currentLanguage(): Language {
  return i18n.resolvedLanguage as Language || 'pt-BR';
}
export function formatTime(value: string | number | Date) {
  return new Intl.DateTimeFormat(currentLanguage(), {hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}
export function formatDateTime(value: string | number | Date) {
  return new Intl.DateTimeFormat(currentLanguage(), {dateStyle:'short',timeStyle:'short'}).format(new Date(value));
}
export function formatDay(value: string | number | Date) {
  return new Intl.DateTimeFormat(currentLanguage(), {day:'numeric',month:'long'}).format(new Date(value));
}
export function formatNumber(value:number) {
  return new Intl.NumberFormat(currentLanguage()).format(value);
}

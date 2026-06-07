import { en } from './en';
import { id } from './id';

export type SupportedLocale = 'en' | 'id';

export const locales = { en, id } as const;

export function getLocale(lang?: string | null): typeof en {
  if (lang === 'id') return id;
  return en;
}

export { en, id };

import type { AppLocale } from './locales';
export type Messages = { [key: string]: string | Messages };
export function mergeMessages(fallback: Messages, selected: Messages): Messages {
  const result: Messages = {...fallback};
  for (const [key,value] of Object.entries(selected)) {
    if (typeof value === 'string') {
      if (value.trim()) result[key] = value;
    } else result[key] = mergeMessages(typeof fallback[key] === 'object' ? fallback[key] : {}, value);
  }
  return result;
}
/** Only the requested bundle and the default fallback are read on the server. */
export async function loadMessages(locale: AppLocale) {
  const fallback = (await import('../../messages/de.json')).default;
  if (locale === 'de') return fallback;
  const selected = await ({en:()=>import('../../messages/en.json'),es:()=>import('../../messages/es.json'),it:()=>import('../../messages/it.json'),cs:()=>import('../../messages/cs.json'),hu:()=>import('../../messages/hu.json'),nl:()=>import('../../messages/nl.json'),'nl-BE':()=>import('../../messages/nl-BE.json'),sv:()=>import('../../messages/sv.json'),fr:()=>import('../../messages/fr.json'),pl:()=>import('../../messages/pl.json'),'pt-PT':()=>import('../../messages/pt-PT.json'),'zh-Hans':()=>import('../../messages/zh-Hans.json'),ja:()=>import('../../messages/ja.json'),ko:()=>import('../../messages/ko.json'),ru:()=>import('../../messages/ru.json'),uk:()=>import('../../messages/uk.json')}[locale])();
  return mergeMessages(fallback, selected.default);
}

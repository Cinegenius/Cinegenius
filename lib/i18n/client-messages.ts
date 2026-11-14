import type { AbstractIntlMessages } from 'next-intl';
import omissions from './client-message-omissions.json';

/** Server rendering retains the complete catalog; only browser copy is serialized. */
export function clientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const result = {...messages};
  for (const [namespace, keys] of Object.entries(omissions)) {
    const values = messages[namespace];
    if (!values || typeof values !== 'object') continue;
    const selected = {...values};
    for (const key of keys) delete selected[key];
    result[namespace] = selected;
  }
  return result;
}

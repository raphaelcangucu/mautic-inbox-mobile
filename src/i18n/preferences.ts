import AsyncStorage from '@react-native-async-storage/async-storage';
import {getLocales} from 'expo-localization';
import {create} from 'zustand';
import {i18n} from './engine';
import {checkedPreference,resolveLanguage,type Language,type LanguagePreference} from './language';

const storageKey = 'mautic-inbox-language-v1';
const deviceLanguages = () => getLocales().map(locale => locale.languageTag);
type State = {preference:LanguagePreference; language:Language; ready:boolean};
export const useLanguage = create<State>(() => ({preference:'system',language:'pt-BR',ready:false}));
let hydration:Promise<void>|undefined;
let writes:Promise<void> = Promise.resolve();

async function apply(preference:LanguagePreference) {
  const language = resolveLanguage(preference,deviceLanguages());
  await i18n.changeLanguage(language);
  useLanguage.setState({preference,language,ready:true});
}

export function initializeLanguage() {
  return hydration ??= (async () => {
    let stored:unknown;
    try {stored = await AsyncStorage.getItem(storageKey)} catch {stored = 'system'}
    await apply(checkedPreference(stored));
  })();
}

export function setLanguagePreference(preference:LanguagePreference) {
  const next = checkedPreference(preference);
  // A second tap must not race a slower first write and restore the old choice on restart.
  const task = writes.catch(() => {}).then(async () => {
    await initializeLanguage();
    await AsyncStorage.setItem(storageKey,next);
    await apply(next);
  });
  writes = task;
  return task;
}

export async function refreshSystemLanguage() {
  await initializeLanguage();
  await writes.catch(() => {});
  if (useLanguage.getState().preference === 'system') await apply('system');
}

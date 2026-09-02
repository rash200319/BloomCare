import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageCode } from '../types';

const LANGUAGE_KEY = 'bloomcare_app_language';

export async function loadLanguage(): Promise<LanguageCode> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored === 'en' || stored === 'si' || stored === 'ta') {
      return stored;
    }
  } catch {
    // Ignore storage errors and fall back to English.
  }
  return 'en';
}

export async function saveLanguage(language: LanguageCode): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Non-fatal if persistence fails.
  }
}

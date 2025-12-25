import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import de from './de.json';

const lng = (import.meta.env.VITE_I18N_DEFAULT_LANG as string) || 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de } },
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;


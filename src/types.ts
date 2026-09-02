export interface PhysicsTerm {
  term: string;
  translatedTerm?: string;
  definition: string;
}

export interface CaptionSegment {
  id: string;
  timestamp: number;
  originalText: string;
  detectedLanguage?: string;
  translations: Record<string, string>;
  physicsTerms?: PhysicsTerm[];
}

export type ViewMode = "standard" | "transcript";

export type CaptionPosition = "bottom" | "top" | "floating";

export type FontSize = "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";

export interface CaptionSettings {
  inputLanguage: string; // "auto" or code like "en", "es", "he", etc.
  targetLanguage: string;
  opacity: number; // 0 to 100
  fontSize: FontSize;
  position: CaptionPosition;
  bilingual: boolean;
  highContrast: boolean;
  highlightPhysicsTerms: boolean;
  autoScroll: boolean;
  theme: "dark" | "light" | "glass";
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface InputLanguageOption {
  code: string;
  speechCode: string; // for Web Speech API (e.g. 'en-US', 'es-ES', 'he-IL')
  name: string;
  flag: string;
}

export const SUPPORTED_INPUT_LANGUAGES: InputLanguageOption[] = [
  { code: "auto", speechCode: "auto", name: "Auto-detect (Recommended)", flag: "🌐" },
  { code: "en", speechCode: "en-US", name: "English", flag: "🇺🇸" },
  { code: "es", speechCode: "es-ES", name: "Spanish (Español)", flag: "🇪🇸" },
  { code: "he", speechCode: "he-IL", name: "Hebrew (עברית)", flag: "🇮🇱" },
  { code: "fr", speechCode: "fr-FR", name: "French (Français)", flag: "🇫🇷" },
  { code: "ar", speechCode: "ar-SA", name: "Arabic (العربية)", flag: "🇸🇦" },
  { code: "zh", speechCode: "zh-CN", name: "Chinese (中文)", flag: "🇨🇳" },
  { code: "pt", speechCode: "pt-BR", name: "Portuguese (Português)", flag: "🇧🇷" },
  { code: "de", speechCode: "de-DE", name: "German (Deutsch)", flag: "🇩🇪" },
  { code: "ru", speechCode: "ru-RU", name: "Russian (Русский)", flag: "🇷🇺" },
  { code: "it", speechCode: "it-IT", name: "Italian (Italiano)", flag: "🇮🇹" },
  { code: "ja", speechCode: "ja-JP", name: "Japanese (日本語)", flag: "🇯🇵" },
  { code: "ko", speechCode: "ko-KR", name: "Korean (한국어)", flag: "🇰🇷" },
];

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱" },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "ar", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", flag: "🇺🇦" },
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "tl", name: "Tagalog / Filipino", nativeName: "Tagalog", flag: "🇵🇭" },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇰🇪" },
  { code: "fa", name: "Persian / Farsi", nativeName: "فارسی", flag: "🇮🇷" },
  { code: "so", name: "Somali", nativeName: "Soomaali", flag: "🇸🇴" },
  { code: "am", name: "Amharic", nativeName: "አማርኛ", flag: "🇪🇹" },
  { code: "ht", name: "Haitian Creole", nativeName: "Kreyòl Ayisyen", flag: "🇭🇹" },
  { code: "en", name: "English (Captions Only)", nativeName: "English", flag: "🇺🇸" },
];

export const PHYSICS_TOPICS = [
  "Newton's 1st Law (Inertia)",
  "Newton's 2nd Law (F = ma)",
  "Newton's 3rd Law (Action & Reaction)",
  "Gravity, Mass & Weight",
  "Velocity & Acceleration",
  "Friction & Air Resistance",
  "Kinetic & Potential Energy",
  "Conservation of Energy",
  "Work and Power (W = Fd)",
  "Waves, Sound & Frequency",
  "Light, Reflection & Refraction",
  "Electricity, Current & Circuits (Ohm's Law)",
  "Magnets & Electromagnetism",
  "Thermal Energy & Heat Transfer",
];

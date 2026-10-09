export type DicebearStyle = "thumbs" | "avataaars" | "big-smile" | "micah";

export interface AvatarStyleOption {
  id: DicebearStyle;
  label: string;
  description: string;
}

export const AVAILABLE_AVATAR_STYLES: AvatarStyleOption[] = [
  {
    id: "thumbs",
    label: "Thumbs",
    description: "Karakter wajah ramah & minimalis",
  },
  {
    id: "avataaars",
    label: "Avataaars",
    description: "Ilustrasi avatar kartun manusia klasik",
  },
  {
    id: "big-smile",
    label: "Big Smile",
    description: "Karakter ekspresif ceria penuh senyum",
  },
  {
    id: "micah",
    label: "Micah",
    description: "Potret artistik modern kontemporer",
  },
];

export const STORAGE_AVATAR_KEY = "wm_avatar_style_preference";
export const AVATAR_STYLE_CHANGE_EVENT = "wm:avatar_style_changed";

export function getDicebearAvatarUrl(
  seed: string,
  style: DicebearStyle = "thumbs"
): string {
  const cleanSeed = encodeURIComponent(seed.trim().toLowerCase() || "user");
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${cleanSeed}`;
}

export function getSavedAvatarStyle(): DicebearStyle {
  if (typeof window === "undefined") return "thumbs";
  try {
    const saved = localStorage.getItem(STORAGE_AVATAR_KEY) as DicebearStyle | null;
    if (saved && AVAILABLE_AVATAR_STYLES.some((s) => s.id === saved)) {
      return saved;
    }
  } catch {
    // Fallback silent
  }
  return "thumbs";
}

export function saveAvatarStyle(style: DicebearStyle): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_AVATAR_KEY, style);
    window.dispatchEvent(
      new CustomEvent(AVATAR_STYLE_CHANGE_EVENT, { detail: style })
    );
  } catch {
    // Fallback silent
  }
}

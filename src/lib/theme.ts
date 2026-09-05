import type { CSSProperties } from "react";

/** Modelos prontos de site que os noivos podem escolher. */
export const TEMPLATES = [
  {
    id: "classico",
    name: "Clássico",
    description: "Verde profundo com dourado, elegante e atemporal.",
    primary: "#2f4a3c",
    accent: "#c9a227",
    background: "#faf8f3",
    fontDisplay: "Cormorant Garamond",
    fontBody: "Jost",
  },
  {
    id: "romantico",
    name: "Romântico",
    description: "Rosé suave com toques de champagne.",
    primary: "#8a5566",
    accent: "#d9a7a0",
    background: "#fdf6f4",
    fontDisplay: "Playfair Display",
    fontBody: "Lato",
  },
  {
    id: "moderno",
    name: "Moderno",
    description: "Preto, branco e linhas limpas.",
    primary: "#1e1e1e",
    accent: "#a58a5c",
    background: "#f6f6f6",
    fontDisplay: "Montserrat",
    fontBody: "Montserrat",
  },
  {
    id: "praia",
    name: "Praia",
    description: "Azul sereno com areia clara.",
    primary: "#1f4b63",
    accent: "#e0b878",
    background: "#f4f9fb",
    fontDisplay: "Great Vibes",
    fontBody: "Raleway",
  },
  {
    id: "campo",
    name: "Campo",
    description: "Terracota e verde oliva, clima rústico.",
    primary: "#6b4030",
    accent: "#8f9a5b",
    background: "#fbf7f0",
    fontDisplay: "Lora",
    fontBody: "Raleway",
  },
] as const;

export type TemplateId = (typeof TEMPLATES)[number]["id"];

export const DISPLAY_FONTS = [
  "Cormorant Garamond",
  "Playfair Display",
  "Great Vibes",
  "Lora",
  "Montserrat",
  "Poppins",
] as const;

export const BODY_FONTS = ["Jost", "Lato", "Raleway", "Montserrat", "Poppins", "Lora"] as const;

export type WeddingTheme = {
  theme_template?: string | null;
  theme_primary?: string | null;
  theme_accent?: string | null;
  theme_background?: string | null;
  theme_font_display?: string | null;
  theme_font_body?: string | null;
};

export function templateById(id: string | null | undefined) {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/** Resolve o visual final (modelo + ajustes manuais dos noivos). */
export function resolveTheme(wedding: WeddingTheme | null | undefined) {
  const base = templateById(wedding?.theme_template);
  return {
    templateId: base.id as string,
    primary: wedding?.theme_primary || base.primary,
    accent: wedding?.theme_accent || base.accent,
    background: wedding?.theme_background || base.background,
    fontDisplay: wedding?.theme_font_display || base.fontDisplay,
    fontBody: wedding?.theme_font_body || base.fontBody,
  };
}

/** Variáveis CSS aplicadas no container do site do casal. */
export function themeStyle(wedding: WeddingTheme | null | undefined): CSSProperties {
  const t = resolveTheme(wedding);
  return {
    "--primary": t.primary,
    "--ring": t.primary,
    "--accent": t.accent,
    "--accent-foreground": "#ffffff",
    "--background": t.background,
    "--font-display": `"${t.fontDisplay}", Georgia, serif`,
    "--font-sans": `"${t.fontBody}", ui-sans-serif, system-ui, sans-serif`,
    fontFamily: `"${t.fontBody}", ui-sans-serif, system-ui, sans-serif`,
  } as CSSProperties;
}

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CoverPreviewSettings = {
  hero_height?: string | null;
  hero_fit?: string | null;
  hero_pos_x?: number | null;
  hero_pos_y?: number | null;
  hero_opacity?: number | null;
  hero_title?: string | null;
  hero_text_color?: string | null;
  bride_name?: string | null;
  groom_name?: string | null;
};

/** Reference viewports keep image geometry identical to the public cover. */
export function CoverPhotoPreview({ src, settings = {} }: { src: string; settings?: CoverPreviewSettings }) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const width = device === "mobile" ? 390 : 1280;
  const height = device === "mobile" ? 844 : 900;
  const fraction = settings.hero_height === "normal" ? .45 : settings.hero_height === "tela" ? 1 : .72;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={device === "mobile" ? "default" : "outline"} onClick={() => setDevice("mobile")}><Smartphone className="size-4" />Celular</Button>
        <Button type="button" size="sm" variant={device === "desktop" ? "default" : "outline"} onClick={() => setDevice("desktop")}><Monitor className="size-4" />Computador</Button>
      </div>
      <div className={`relative mx-auto flex w-full items-center justify-center overflow-hidden rounded-lg border border-border ${device === "mobile" ? "max-w-[250px]" : ""}`} style={{ aspectRatio: `${width} / ${height * fraction}`, backgroundImage: "var(--hero-gradient)" }}>
        <img src={src} alt={`Prévia da capa no ${device === "mobile" ? "celular" : "computador"}`} className={`absolute inset-0 size-full ${settings.hero_fit === "inteira" ? "object-contain" : "object-cover"}`} style={{ objectPosition: `${settings.hero_pos_x ?? 50}% ${settings.hero_pos_y ?? 50}%`, opacity: (settings.hero_opacity ?? 30) / 100 }} />
        <p className="relative whitespace-pre-line px-4 text-center font-display text-xl" style={settings.hero_text_color ? { color: settings.hero_text_color } : undefined}>{settings.hero_title?.trim() || `${settings.bride_name ?? "Noiva"} & ${settings.groom_name ?? "Noivo"}`}</p>
      </div>
      <p className="text-xs text-muted-foreground">Referência: {width} × {height} px. O recorte acompanha o tamanho da tela do convidado.</p>
    </div>
  );
}

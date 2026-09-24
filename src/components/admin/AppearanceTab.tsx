import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Palette } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DISPLAY_FONTS, TEMPLATES, resolveTheme, themeStyle } from "@/lib/theme";

type Props = { weddingId: string | null };

export function AppearanceTab({ weddingId }: Props) {
  const queryClient = useQueryClient();

  const weddingQuery = useQuery({
    queryKey: ["panel", "theme", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select(
          "id, bride_name, groom_name, wedding_date, ceremony_time, venue, party_venue, tagline, cover_image_url, hero_title, hero_opacity, hero_height, hero_fit, hero_text_color, hero_pos_x, hero_pos_y, theme_template, theme_primary, theme_accent, theme_background, theme_font_display, theme_font_body",
        )
        .eq("id", weddingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [draft, setDraft] = useState(() => resolveTheme(null));

  useEffect(() => {
    if (weddingQuery.data) setDraft(resolveTheme(weddingQuery.data));
  }, [weddingQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("weddings")
        .update({
          theme_template: draft.templateId,
          theme_primary: draft.primary,
          theme_accent: draft.accent,
          theme_background: draft.background,
          theme_font_display: draft.fontDisplay,
          theme_font_body: "Jost",
        })
        .eq("id", weddingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visual do site atualizado!");
      queryClient.invalidateQueries({ queryKey: ["panel", "theme", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding"] });
    },
    onError: (e: Error) => toast.error("Não deu para salvar", { description: e.message }),
  });

  const previewStyle = themeStyle({
    theme_template: draft.templateId,
    theme_primary: draft.primary,
    theme_accent: draft.accent,
    theme_background: draft.background,
    theme_font_display: draft.fontDisplay,
    theme_font_body: draft.fontBody,
  });
  const wedding = weddingQuery.data;
  const previewTitle = wedding?.hero_title?.trim() || `${wedding?.bride_name ?? "Noiva"} & ${wedding?.groom_name ?? "Noivo"}`;
  const previewDate = wedding?.wedding_date
    ? new Date(`${wedding.wedding_date}T12:00:00`).toLocaleDateString("pt-BR", { dateStyle: "long" })
    : null;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Modelo do site</CardTitle>
          <CardDescription>
            Escolha um estilo pronto e depois ajuste as cores e a letra dos títulos.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((tpl) => {
            const selected = tpl.id === draft.templateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() =>
                  setDraft({
                    templateId: tpl.id,
                    primary: tpl.primary,
                    accent: tpl.accent,
                    background: tpl.background,
                    fontDisplay: tpl.fontDisplay,
                    fontBody: tpl.fontBody,
                  })
                }
                className={`rounded-lg border p-4 text-left transition ${
                  selected ? "border-primary ring-2 ring-primary/40" : "border-border/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-lg"
                    style={{ fontFamily: `"${tpl.fontDisplay}", Georgia, serif` }}
                  >
                    {tpl.name}
                  </span>
                  {selected ? <Check className="size-4 text-primary" /> : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p>
                <div className="mt-3 flex gap-2">
                  {[tpl.primary, tpl.accent, tpl.background].map((c) => (
                    <span
                      key={c}
                      className="size-6 rounded-full border border-border/70"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Cores e títulos</CardTitle>
          <CardDescription>Personalize cada detalhe do visual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          {(
            [
              ["primary", "Cor principal"],
              ["accent", "Cor de destaque"],
              ["background", "Cor de fundo"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`color-${key}`}>{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  id={`color-${key}`}
                  type="color"
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
                />
                <Input
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  maxLength={7}
                />
              </div>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Letra dos títulos</Label>
            <Select
              value={draft.fontDisplay}
              onValueChange={(v) => setDraft({ ...draft, fontDisplay: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPLAY_FONTS.map((f) => (
                  <SelectItem key={f} value={f} style={{ fontFamily: `"${f}", serif` }}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Textos do site</Label>
            <div className="flex min-h-10 items-center rounded-md border border-input bg-muted/35 px-3 text-sm text-muted-foreground">
              Fonte simples e legível, adequada para leitura no celular.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Prévia</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            style={{ ...previewStyle, backgroundImage: "var(--hero-gradient)" }}
            className={`relative flex items-center justify-center overflow-hidden rounded-lg border border-border/70 text-center ${
              wedding?.hero_height === "normal" ? "min-h-56" : wedding?.hero_height === "tela" ? "min-h-96" : "min-h-72"
            }`}
          >
            {wedding?.cover_image_url ? (
              <img
                src={wedding.cover_image_url}
                alt="Prévia da capa"
                className={`absolute inset-0 size-full ${wedding.hero_fit === "inteira" ? "object-contain" : "object-cover"}`}
                style={{
                  opacity: Math.min(100, Math.max(0, wedding.hero_opacity ?? 30)) / 100,
                  objectPosition: `${wedding.hero_pos_x ?? 50}% ${wedding.hero_pos_y ?? 50}%`,
                }}
              />
            ) : null}
            <div
              className="relative max-w-3xl px-4 py-10"
              style={wedding?.hero_text_color ? { color: wedding.hero_text_color } : undefined}
            >
              <h1 className="text-balance-title whitespace-pre-line font-display text-4xl font-semibold sm:text-5xl">
                {previewTitle}
              </h1>
              <div className="divider-gold mx-auto my-5 w-24" />
              {previewDate ? (
                <p className={`text-xs uppercase tracking-[0.16em] ${wedding?.hero_text_color ? "opacity-90" : "text-muted-foreground"}`}>
                  {previewDate}{wedding?.ceremony_time ? ` · ${wedding.ceremony_time}` : ""}
                </p>
              ) : null}
              {wedding?.party_venue || wedding?.venue ? (
                <p className={`mt-3 text-sm ${wedding.hero_text_color ? "opacity-90" : "text-muted-foreground"}`}>
                  {wedding.party_venue ?? wedding.venue}
                </p>
              ) : null}
              {wedding?.tagline ? (
                <p className={`mx-auto mt-5 max-w-xl whitespace-pre-line text-sm italic ${wedding.hero_text_color ? "opacity-90" : "text-muted-foreground"}`}>
                  {wedding.tagline}
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={!weddingId || save.isPending}>
        <Palette className="size-4" /> Salvar visual
      </Button>
    </div>
  );
}

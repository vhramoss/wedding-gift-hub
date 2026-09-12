import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, Music, Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Draft = {
  hero_opacity: number;
  hero_height: string;
  hero_fit: string;
  hero_text_color: string;
  hero_pos_x: number;
  hero_pos_y: number;
  hero_rotate_seconds: number;
  music_enabled: boolean;
  music_autoplay: boolean;
  music_url: string;
  music_title: string;
};

const EMPTY: Draft = {
  hero_opacity: 30,
  hero_height: "grande",
  hero_fit: "cobrir",
  hero_text_color: "",
  hero_pos_x: 50,
  hero_pos_y: 50,
  hero_rotate_seconds: 7,
  music_enabled: false,
  music_autoplay: true,
  music_url: "",
  music_title: "",
};

const PREVIEW_HEIGHT: Record<string, string> = {
  normal: "h-44",
  grande: "h-64",
  tela: "h-80",
};

export function SiteExtrasTab({ weddingId }: { weddingId: string | null }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);

  const weddingQuery = useQuery({
    queryKey: ["panel", "extras", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select(
          "id, bride_name, groom_name, published, require_login, cover_image_url, hero_opacity, hero_height, hero_fit, hero_text_color, hero_pos_x, hero_pos_y, hero_rotate_seconds, music_enabled, music_autoplay, music_url, music_title",
        )
        .eq("id", weddingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const photosQuery = useQuery({
    queryKey: ["panel", "extras-cover-photos", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_photos")
        .select("id, url")
        .eq("wedding_id", weddingId!)
        .eq("show_in_cover", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const togglePublished = useMutation({
    mutationFn: async (value: boolean) => {
      const { data, error } = await supabase
        .from("weddings")
        .update({ published: value })
        .eq("id", weddingId!)
        .select("id, published")
        .maybeSingle();
      if (error) throw error;
      if (!data || data.published !== value) {
        throw new Error("A alteração não foi confirmada. Atualize a página e tente novamente.");
      }
      return data.published;
    },
    onSuccess: (value) => {
      toast.success(value ? "Site publicado! O link já abre para qualquer pessoa." : "Site voltou a ficar privado.");
      queryClient.invalidateQueries({ queryKey: ["panel", "extras", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding"] });
    },
    onError: (e: Error) => toast.error("Não deu para mudar", { description: e.message }),
  });

  const toggleRequireLogin = useMutation({
    mutationFn: async (value: boolean) => {
      const { data, error } = await supabase
        .from("weddings")
        .update({ require_login: value })
        .eq("id", weddingId!)
        .select("id, require_login")
        .maybeSingle();
      if (error) throw error;
      if (!data || data.require_login !== value) {
        throw new Error("A alteração não foi confirmada. Atualize a página e tente novamente.");
      }
      return data.require_login;
    },
    onSuccess: (value) => {
      toast.success(
        value
          ? "Agora o site pede login para abrir."
          : "Site liberado para qualquer pessoa com o link.",
      );
      queryClient.invalidateQueries({ queryKey: ["panel", "extras", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding"] });
    },
    onError: (e: Error) => toast.error("Não deu para mudar", { description: e.message }),
  });

  useEffect(() => {
    const w = weddingQuery.data;
    if (!w) return;
    setDraft({
      hero_opacity: w.hero_opacity ?? 30,
      hero_height: w.hero_height ?? "grande",
      hero_fit: w.hero_fit ?? "cobrir",
      hero_text_color: w.hero_text_color ?? "",
      hero_pos_x: w.hero_pos_x ?? 50,
      hero_pos_y: w.hero_pos_y ?? 50,
      hero_rotate_seconds: w.hero_rotate_seconds ?? 7,
      music_enabled: w.music_enabled ?? false,
      music_autoplay: w.music_autoplay ?? true,
      music_url: w.music_url ?? "",
      music_title: w.music_title ?? "",
    });
  }, [weddingQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("weddings")
        .update({
          hero_opacity: Math.min(100, Math.max(0, Number(draft.hero_opacity) || 0)),
          hero_height: draft.hero_height,
          hero_fit: draft.hero_fit,
          hero_text_color: draft.hero_text_color.trim() || null,
          hero_pos_x: Math.min(100, Math.max(0, Number(draft.hero_pos_x) || 0)),
          hero_pos_y: Math.min(100, Math.max(0, Number(draft.hero_pos_y) || 0)),
          hero_rotate_seconds: Math.min(60, Math.max(3, Number(draft.hero_rotate_seconds) || 7)),
          music_enabled: draft.music_enabled,
          music_autoplay: draft.music_autoplay,
          music_url: draft.music_url.trim() || null,
          music_title: draft.music_title.trim() || null,
        })
        .eq("id", weddingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Capa e música atualizadas!");
      queryClient.invalidateQueries({ queryKey: ["panel", "extras", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding"] });
    },
    onError: (e: Error) => toast.error("Não deu para salvar", { description: e.message }),
  });

  if (!weddingId) return null;

  const wedding = weddingQuery.data;
  const previewPhotos = [
    ...(wedding?.cover_image_url ? [wedding.cover_image_url] : []),
    ...(photosQuery.data ?? []).map((p) => p.url),
  ];
  const previewSrc = previewPhotos[0] ?? null;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Link do site</CardTitle>
          <CardDescription>
            Enquanto estiver desligado, só vocês enxergam o site. Ligando, qualquer pessoa com o
            link entra sem fazer conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <p className="font-medium">Site aberto para os convidados</p>
              <p className="text-sm text-muted-foreground">
                {wedding?.published ? "Publicado" : "Rascunho (ninguém de fora consegue abrir)"}
              </p>
            </div>
            <Switch
              checked={Boolean(wedding?.published)}
              disabled={togglePublished.isPending}
              onCheckedChange={(v) => togglePublished.mutate(v)}
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <p className="font-medium">Pedir login para ver o site</p>
              <p className="text-sm text-muted-foreground">
                Ligado, só quem tem conta consegue abrir o site de vocês.
              </p>
            </div>
            <Switch
              checked={Boolean(wedding?.require_login)}
              disabled={toggleRequireLogin.isPending}
              onCheckedChange={(v) => toggleRequireLogin.mutate(v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Pré-visualização da capa</CardTitle>
          <CardDescription>
            É assim que a capa vai ficar. Ajuste abaixo e veja mudar na hora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative flex items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-secondary/40 ${
              PREVIEW_HEIGHT[draft.hero_height] ?? PREVIEW_HEIGHT["grande"]
            }`}
          >
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="Prévia da capa"
                className={`absolute inset-0 size-full ${
                  draft.hero_fit === "inteira" ? "object-contain" : "object-cover"
                }`}
                style={{
                  opacity: draft.hero_opacity / 100,
                  objectPosition: `${draft.hero_pos_x}% ${draft.hero_pos_y}%`,
                }}
              />
            ) : (
              <p className="px-4 text-center text-sm text-muted-foreground">
                Envie uma foto de capa em “Fotos” para ver a prévia.
              </p>
            )}
            <div
              className="relative px-4 text-center"
              style={draft.hero_text_color ? { color: draft.hero_text_color } : undefined}
            >
              <p className="font-display text-2xl sm:text-3xl">
                {wedding?.bride_name ?? "Noiva"} & {wedding?.groom_name ?? "Noivo"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ImageIcon className="size-5 text-accent" /> Capa do site
          </CardTitle>
          <CardDescription>
            É o quadro grande com os nomes de vocês. As fotos marcadas em “Fotos” trocam sozinhas
            nessa capa.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="hero-opacity">
              Quanto a foto aparece: {draft.hero_opacity}%
            </Label>
            <input
              id="hero-opacity"
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.hero_opacity}
              onChange={(e) => setDraft({ ...draft, hero_opacity: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
            <p className="text-xs text-muted-foreground">
              Quanto maior, mais forte a foto — e menos leitura têm os nomes.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tamanho da capa</Label>
            <Select
              value={draft.hero_height}
              onValueChange={(v) => setDraft({ ...draft, hero_height: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="grande">Grande</SelectItem>
                <SelectItem value="tela">Tela cheia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="hero-text-color">Cor das letras da capa</Label>
            <div className="flex items-center gap-2">
              <input
                id="hero-text-color"
                type="color"
                value={draft.hero_text_color || "#ffffff"}
                onChange={(e) => setDraft({ ...draft, hero_text_color: e.target.value })}
                className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
              />
              <Input
                value={draft.hero_text_color}
                placeholder="Automático"
                maxLength={7}
                onChange={(e) => setDraft({ ...draft, hero_text_color: e.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraft({ ...draft, hero_text_color: "" })}
              >
                Automático
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use branco quando a foto for escura e um tom escuro quando a foto for clara.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Enquadramento da foto</Label>
            <Select value={draft.hero_fit} onValueChange={(v) => setDraft({ ...draft, hero_fit: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cobrir">Preencher a capa toda</SelectItem>
                <SelectItem value="inteira">Mostrar a foto inteira (sem cortar)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="hero-pos-x">Mover a foto na horizontal: {draft.hero_pos_x}%</Label>
            <input
              id="hero-pos-x"
              type="range"
              min={0}
              max={100}
              step={1}
              value={draft.hero_pos_x}
              onChange={(e) => setDraft({ ...draft, hero_pos_x: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
            <Label htmlFor="hero-pos-y">Mover a foto na vertical: {draft.hero_pos_y}%</Label>
            <input
              id="hero-pos-y"
              type="range"
              min={0}
              max={100}
              step={1}
              value={draft.hero_pos_y}
              onChange={(e) => setDraft({ ...draft, hero_pos_y: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
            <p className="text-xs text-muted-foreground">
              Use para centralizar os rostos quando a foto ficar cortada.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero-seconds">Trocar de foto a cada (segundos)</Label>
            <Input
              id="hero-seconds"
              type="number"
              min={3}
              max={60}
              value={draft.hero_rotate_seconds}
              onChange={(e) => setDraft({ ...draft, hero_rotate_seconds: Number(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Music className="size-5 text-accent" /> Música do site
          </CardTitle>
          <CardDescription>
            Cole o link de um arquivo de música (MP3). Os convidados sempre podem pausar pelo botão
            que fica no canto da tela.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <p className="font-medium">Tocar música no site</p>
              <p className="text-sm text-muted-foreground">Vale para todas as páginas do casal.</p>
            </div>
            <Switch
              checked={draft.music_enabled}
              onCheckedChange={(v) => setDraft({ ...draft, music_enabled: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <p className="font-medium">Começar sozinha</p>
              <p className="text-sm text-muted-foreground">
                Alguns celulares só liberam o som depois do primeiro toque na tela.
              </p>
            </div>
            <Switch
              checked={draft.music_autoplay}
              onCheckedChange={(v) => setDraft({ ...draft, music_autoplay: v })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="music-url">Link da música (MP3)</Label>
            <Input
              id="music-url"
              value={draft.music_url}
              placeholder="https://.../nossa-musica.mp3"
              onChange={(e) => setDraft({ ...draft, music_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="music-title">Nome da música (opcional)</Label>
            <Input
              id="music-title"
              value={draft.music_title}
              placeholder="Perfect · Ed Sheeran"
              onChange={(e) => setDraft({ ...draft, music_title: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        <Save className="size-4" /> Salvar capa e música
      </Button>
    </div>
  );
}

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
  hero_rotate_seconds: number;
  music_enabled: boolean;
  music_autoplay: boolean;
  music_url: string;
  music_title: string;
};

const EMPTY: Draft = {
  hero_opacity: 30,
  hero_height: "grande",
  hero_rotate_seconds: 7,
  music_enabled: false,
  music_autoplay: true,
  music_url: "",
  music_title: "",
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
          "id, hero_opacity, hero_height, hero_rotate_seconds, music_enabled, music_autoplay, music_url, music_title",
        )
        .eq("id", weddingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const w = weddingQuery.data;
    if (!w) return;
    setDraft({
      hero_opacity: w.hero_opacity ?? 30,
      hero_height: w.hero_height ?? "grande",
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

  return (
    <div className="space-y-6">
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

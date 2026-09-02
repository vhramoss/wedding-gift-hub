import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WeddingPhotosTab({ weddingId }: { weddingId: string | null }) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  const photosQuery = useQuery({
    queryKey: ["panel", "photos", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_photos")
        .select("*")
        .eq("wedding_id", weddingId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addPhoto = useMutation({
    mutationFn: async () => {
      if (!url) throw new Error("Envie uma foto ou cole um link.");
      const { error } = await supabase.from("wedding_photos").insert({
        wedding_id: weddingId!,
        url,
        caption: caption.trim() || null,
        sort_order: (photosQuery.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setUrl("");
      setCaption("");
      toast.success("Foto adicionada à galeria!");
      queryClient.invalidateQueries({ queryKey: ["panel", "photos", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding-photos"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const removePhoto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panel", "photos", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding-photos"] });
    },
  });

  if (!weddingId) return null;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Nossa galeria</CardTitle>
          <CardDescription>
            Envie as fotos do casal. Elas aparecem na página “Galeria” do site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImageUploadField
            label="Foto"
            value={url}
            weddingId={weddingId}
            onChange={setUrl}
            hint="JPG ou PNG de até 10 MB."
          />
          <div className="space-y-2">
            <Label htmlFor="caption">Legenda (opcional)</Label>
            <Input
              id="caption"
              value={caption}
              maxLength={140}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Nosso primeiro rolê juntos"
            />
          </div>
          <Button onClick={() => addPhoto.mutate()} disabled={addPhoto.isPending}>
            <Plus className="size-4" /> Adicionar à galeria
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(photosQuery.data ?? []).map((photo) => (
          <Card key={photo.id} className="overflow-hidden">
            <img
              src={photo.url}
              alt={photo.caption ?? "Foto do casal"}
              className="h-48 w-full object-cover"
              loading="lazy"
            />
            <CardContent className="flex items-center justify-between gap-2 pt-4">
              <span className="text-sm text-muted-foreground">{photo.caption ?? "Sem legenda"}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover foto"
                onClick={() => removePhoto.mutate(photo.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {(photosQuery.data ?? []).length === 0 ? (
        <p className="text-muted-foreground">Nenhuma foto ainda.</p>
      ) : null}
    </div>
  );
}

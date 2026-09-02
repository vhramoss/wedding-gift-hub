import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = { weddingId: string | null };

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


const TEXT_FIELDS = [
  { name: "tagline", label: "Frase de abertura", area: false },
  { name: "welcome_message", label: "Mensagem de boas-vindas", area: true },
  { name: "story_how_we_met", label: "Como nos conhecemos", area: true },
  { name: "story_proposal", label: "O pedido", area: true },
  { name: "story_text", label: "E chegamos até aqui", area: true },
  { name: "ceremony_venue", label: "Local da cerimônia", area: false },
  { name: "ceremony_address", label: "Endereço da cerimônia", area: false },
  { name: "ceremony_time", label: "Horário da cerimônia", area: false },
  { name: "ceremony_map_url", label: "Link do mapa (cerimônia)", area: false },
  { name: "party_venue", label: "Local da festa", area: false },
  { name: "party_address", label: "Endereço da festa", area: false },
  { name: "party_time", label: "Horário da festa", area: false },
  { name: "party_map_url", label: "Link do mapa (festa)", area: false },
  { name: "party_image_url", label: "Foto do local da festa (URL)", area: false },
  { name: "dress_code", label: "Traje", area: true },
  { name: "tips", label: "Dicas aos convidados", area: true },
  { name: "hashtag", label: "Hashtag", area: false },
] as const;

export function WeddingContentTab({ weddingId }: Props) {
  const queryClient = useQueryClient();

  const weddingQuery = useQuery({
    queryKey: ["admin", "wedding-content", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weddings")
        .select("*")
        .eq("id", weddingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const peopleQuery = useQuery({
    queryKey: ["admin", "people", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_people")
        .select("*")
        .eq("wedding_id", weddingId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const messagesQuery = useQuery({
    queryKey: ["admin", "messages", weddingId],
    enabled: Boolean(weddingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_messages")
        .select("*")
        .eq("wedding_id", weddingId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveContent = useMutation({
    mutationFn: async (form: FormData) => {
      const payload: Record<string, string | null> = {};
      for (const field of TEXT_FIELDS) {
        const value = String(form.get(field.name) ?? "").trim();
        payload[field.name] = value || null;
      }
      const { error } = await supabase
        .from("weddings")
        .update(payload as never)
        .eq("id", weddingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conteúdo salvo!");
      queryClient.invalidateQueries({ queryKey: ["admin", "wedding-content", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const saveDates = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase
        .from("weddings")
        .update({
          wedding_date: String(form.get("wedding_date") ?? "") || null,
          rsvp_deadline: String(form.get("rsvp_deadline") ?? "") || null,
        })
        .eq("id", weddingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Datas salvas!");
      queryClient.invalidateQueries({ queryKey: ["admin", "wedding-content", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding"] });
      queryClient.invalidateQueries({ queryKey: ["main-wedding"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar datas", { description: e.message }),
  });

  const saveSlug = useMutation({
    mutationFn: async (form: FormData) => {
      const slug = slugify(String(form.get("slug") ?? ""));
      if (slug.length < 3) throw new Error("Use pelo menos 3 caracteres (letras, números ou hífen).");
      const { error } = await supabase.from("weddings").update({ slug }).eq("id", weddingId!);
      if (error) {
        throw new Error(
          error.code === "23505" ? "Esse link já está em uso. Escolha outro." : error.message,
        );
      }
      return slug;
    },
    onSuccess: (slug) => {
      toast.success("Link atualizado!", { description: `/casamento/${slug}` });
      queryClient.invalidateQueries({ queryKey: ["admin", "wedding-content", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding"] });
      queryClient.invalidateQueries({ queryKey: ["main-wedding"] });
      queryClient.invalidateQueries({ queryKey: ["my-wedding"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar link", { description: e.message }),
  });

  const saveImage = useMutation({

    mutationFn: async ({ column, url }: { column: string; url: string }) => {
      const { error } = await supabase
        .from("weddings")
        .update({ [column]: url || null } as never)
        .eq("id", weddingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto atualizada!");
      queryClient.invalidateQueries({ queryKey: ["admin", "wedding-content", weddingId] });
      queryClient.invalidateQueries({ queryKey: ["wedding"] });
      queryClient.invalidateQueries({ queryKey: ["main-wedding"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar foto", { description: e.message }),
  });

  const addPerson = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase.from("wedding_people").insert({
        wedding_id: weddingId!,
        name: String(form.get("name") ?? "").trim(),
        kind: String(form.get("kind") ?? "padrinho"),
        role: String(form.get("role") ?? "").trim() || null,
        description: String(form.get("description") ?? "").trim() || null,
        photo_url: String(form.get("photo_url") ?? "").trim() || null,
        website_url: String(form.get("website_url") ?? "").trim() || null,
        sort_order: Number(form.get("sort_order") ?? 0) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pessoa adicionada!");
      queryClient.invalidateQueries({ queryKey: ["admin", "people", weddingId] });
    },
    onError: (e: Error) => toast.error("Erro ao adicionar", { description: e.message }),
  });

  const removePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_people").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "people", weddingId] }),
  });

  const moderate = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.from("wedding_messages").update({ approved }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "messages", weddingId] }),
  });

  if (!weddingId) {
    return <p className="text-muted-foreground">Cadastre um casamento primeiro.</p>;
  }

  const wedding = weddingQuery.data as Record<string, string | null> | null;

  const currentSlug = wedding?.['slug'] ?? "";
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Endereço do site</CardTitle>
          <CardDescription>
            Personalize o link que vocês vão compartilhar com os convidados. Use apenas letras,
            números e hífens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            key={`slug-${weddingId}-${currentSlug}`}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveSlug.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="slug">Link do casamento</Label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{origin}/casamento/</span>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={currentSlug}
                  maxLength={80}
                  required
                  placeholder="beatriz-e-pedro"
                  className="w-full sm:w-64"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Link atual: {origin}/casamento/{currentSlug}
              </p>
            </div>
            <Button type="submit" disabled={saveSlug.isPending}>
              Salvar link
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card">

        <CardHeader>
          <CardTitle className="text-xl">Datas</CardTitle>
          <CardDescription>
            A data do casamento aparece no save the date com contagem regressiva. Depois do prazo de
            confirmação, os convidados não podem mais confirmar nem cancelar presença.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            key={`dates-${weddingId}`}
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveDates.mutate(new FormData(e.currentTarget));
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="wedding_date">Data do casamento</Label>
              <Input
                id="wedding_date"
                name="wedding_date"
                type="date"
                defaultValue={wedding?.['wedding_date'] ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rsvp_deadline">Prazo para confirmar/desconfirmar</Label>
              <Input
                id="rsvp_deadline"
                name="rsvp_deadline"
                type="date"
                defaultValue={wedding?.['rsvp_deadline'] ?? ""}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saveDates.isPending}>
                Salvar datas
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Páginas do site</CardTitle>
          <CardDescription>
            Textos exibidos nas abas Nossa história, Cerimônia e festa e no início.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            key={weddingId}
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveContent.mutate(new FormData(e.currentTarget));
            }}
          >
            {TEXT_FIELDS.map((field) => (
              <div
                key={field.name}
                className={`space-y-2 ${field.area ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={field.name}>{field.label}</Label>
                {field.area ? (
                  <Textarea
                    id={field.name}
                    name={field.name}
                    rows={4}
                    defaultValue={wedding?.[field.name] ?? ""}
                  />
                ) : (
                  <Input
                    id={field.name}
                    name={field.name}
                    defaultValue={wedding?.[field.name] ?? ""}
                  />
                )}
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saveContent.isPending}>
                Salvar conteúdo
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Fotos principais</CardTitle>
          <CardDescription>
            A capa aparece no topo do site; a foto da festa ilustra a aba Cerimônia e festa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUploadField
            label="Foto de capa"
            weddingId={weddingId}
            value={wedding?.['cover_image_url'] ?? ""}
            onChange={(url) => saveImage.mutate({ column: "cover_image_url", url })}
          />
          <ImageUploadField
            label="Foto do local da festa"
            weddingId={weddingId}
            value={wedding?.['party_image_url'] ?? ""}
            onChange={(url) => saveImage.mutate({ column: "party_image_url", url })}
          />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Padrinhos, madrinhas e fornecedores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const el = e.currentTarget;
              addPerson.mutate(new FormData(el), { onSuccess: () => el.reset() });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="person-name">Nome</Label>
              <Input id="person-name" name="name" required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-kind">Tipo</Label>
              <Select name="kind" defaultValue="padrinho">
                <SelectTrigger id="person-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="padrinho">Padrinho</SelectItem>
                  <SelectItem value="madrinha">Madrinha</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-role">Função</Label>
              <Input id="person-role" name="role" placeholder="Buffet, Irmão da noiva..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-order">Ordem</Label>
              <Input id="person-order" name="sort_order" type="number" defaultValue={0} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="person-photo">Foto (URL)</Label>
              <Input id="person-photo" name="photo_url" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="person-site">Site (URL)</Label>
              <Input id="person-site" name="website_url" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="person-desc">Descrição</Label>
              <Textarea id="person-desc" name="description" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={addPerson.isPending}>
                Adicionar
              </Button>
            </div>
          </form>

          <div className="space-y-3">
            {(peopleQuery.data ?? []).map((person) => (
              <div
                key={person.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{person.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {person.kind}
                    {person.role ? ` · ${person.role}` : ""}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removePerson.mutate(person.id)}
                  aria-label={`Remover ${person.name}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Recados dos convidados</CardTitle>
          <CardDescription>Aprove os recados para exibi-los no site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(messagesQuery.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">Nenhum recado ainda.</p>
          ) : (
            (messagesQuery.data ?? []).map((message) => (
              <div key={message.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{message.author_name}</p>
                  <Badge variant={message.approved ? "default" : "secondary"}>
                    {message.approved ? "Publicado" : "Pendente"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{message.body}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      moderate.mutate({ id: message.id, approved: !message.approved })
                    }
                  >
                    <Check className="size-4" />
                    {message.approved ? "Ocultar" : "Aprovar"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

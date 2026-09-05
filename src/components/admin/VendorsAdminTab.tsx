import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Star, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function VendorsAdminTab() {
  const queryClient = useQueryClient();

  const vendorsQuery = useQuery({
    queryKey: ["admin", "vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "vendors"] });
    queryClient.invalidateQueries({ queryKey: ["vendors"] });
  };

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const name = String(form.get("name") ?? "").trim();
      if (!name) throw new Error("Informe o nome do fornecedor.");
      const { error } = await supabase.from("vendors").insert({
        name,
        category: String(form.get("category") ?? "").trim() || "Geral",
        description: String(form.get("description") ?? "").trim() || null,
        logo_url: String(form.get("logo") ?? "").trim() || null,
        phone: String(form.get("phone") ?? "").trim() || null,
        whatsapp: String(form.get("whatsapp") ?? "").trim() || null,
        website_url: String(form.get("website") ?? "").trim() || null,
        city: String(form.get("city") ?? "").trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor anunciando no site!");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro ao cadastrar", { description: e.message }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { active?: boolean; featured?: boolean } }) => {
      const { error } = await supabase.from("vendors").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fornecedor removido.");
      invalidate();
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Novo fornecedor anunciante</CardTitle>
          <CardDescription>
            Os anúncios aparecem para os noivos e para os convidados dos casamentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              const el = e.currentTarget;
              e.preventDefault();
              create.mutate(new FormData(el), { onSuccess: () => el.reset() });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Nome</Label>
              <Input id="vendor-name" name="name" required maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-category">Categoria</Label>
              <Input
                id="vendor-category"
                name="category"
                placeholder="Buffet, fotografia, decoração..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-city">Cidade</Label>
              <Input id="vendor-city" name="city" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-phone">Telefone</Label>
              <Input id="vendor-phone" name="phone" placeholder="(19) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-whatsapp">WhatsApp (só números)</Label>
              <Input id="vendor-whatsapp" name="whatsapp" placeholder="19999999999" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-website">Site</Label>
              <Input id="vendor-website" name="website" placeholder="https://..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="vendor-logo">Imagem do anúncio (URL)</Label>
              <Input id="vendor-logo" name="logo" placeholder="https://..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="vendor-description">Descrição</Label>
              <Textarea id="vendor-description" name="description" maxLength={500} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                <Plus className="size-4" /> Cadastrar fornecedor
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(vendorsQuery.data ?? []).map((vendor) => (
          <Card key={vendor.id} className={vendor.active ? "" : "opacity-60"}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg">{vendor.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {vendor.category}
                  {vendor.city ? ` · ${vendor.city}` : ""}
                  {vendor.whatsapp ? ` · ${vendor.whatsapp}` : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  <Badge variant={vendor.active ? "default" : "secondary"}>
                    {vendor.active ? "Anunciando" : "Pausado"}
                  </Badge>
                  {vendor.featured ? <Badge variant="secondary">Destaque</Badge> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update.mutate({ id: vendor.id, patch: { featured: !vendor.featured } })
                  }
                >
                  <Star className="size-4" /> {vendor.featured ? "Tirar destaque" : "Destacar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update.mutate({ id: vendor.id, patch: { active: !vendor.active } })}
                >
                  {vendor.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {vendor.active ? "Pausar" : "Ativar"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover ${vendor.name}`}
                  onClick={() => remove.mutate(vendor.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {(vendorsQuery.data ?? []).length === 0 ? (
          <p className="text-muted-foreground">Nenhum fornecedor cadastrado ainda.</p>
        ) : null}
      </div>
    </div>
  );
}

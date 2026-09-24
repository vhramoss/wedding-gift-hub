import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/cerimonialista/$token")({
  head: () => ({
    meta: [
      { title: "Convite de cerimonialista · Casa Comigo" },
      { name: "description", content: "Cadastre-se como cerimonialista do casamento." },
      { property: "og:title", content: "Convite de cerimonialista · Casa Comigo" },
      { property: "og:description", content: "Aceite o convite e informe sua chave Pix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlannerInvitePage,
});

function PlannerInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [pix, setPix] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");

  const info = useQuery({
    queryKey: ["planner-invite", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("planner_invite_info", { _token: token });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  async function accept() {
    setSaving(true);
    const { data, error } = await supabase.rpc("accept_planner_invite", {
      _token: token,
      _name: name,
      _contact: contact,
      _pix: pix,
    });
    setSaving(false);
    if (error) {
      toast.error("Não deu para concluir", { description: error.message });
      return;
    }
    setDone(String(data ?? ""));
  }

  const invalid = info.isSuccess && (!info.data || !info.data.valid);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-3xl">Convite de cerimonialista</CardTitle>
            <CardDescription>
              {info.isLoading
                ? "Validando convite..."
                : invalid
                  ? "Este convite é inválido, expirou ou já foi usado."
                  : done
                    ? `Pronto! Você é o cerimonialista do casamento de ${done}.`
                    : `Casamento de ${info.data?.bride_name} e ${info.data?.groom_name}. Informe seus dados para receber sua parte.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {done ? (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle2 className="size-10 text-accent" />
                <Button onClick={() => navigate({ to: "/" })}>Ir para o início</Button>
              </div>
            ) : !invalid && info.data ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="pname">Nome completo</Label>
                  <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pcontact">WhatsApp</Label>
                  <Input id="pcontact" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ppix">Chave Pix</Label>
                  <Input id="ppix" value={pix} onChange={(e) => setPix(e.target.value)} />
                </div>
                <Button className="w-full" disabled={saving} onClick={accept}>
                  {saving ? "Salvando..." : "Aceitar convite"}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

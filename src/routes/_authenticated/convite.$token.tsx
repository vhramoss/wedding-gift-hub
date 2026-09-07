import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/convite/$token")({
  head: () => ({
    meta: [
      { title: "Convite de acesso · Nosso Casamento" },
      {
        name: "description",
        content: "Use seu link de convite para liberar o acesso como noivos ou como convidado.",
      },
      { property: "og:title", content: "Convite de acesso" },
      { property: "og:description", content: "Ative seu acesso ao site do casamento." },
    ],
  }),
  component: RedeemInvitePage,
});

function RedeemInvitePage() {
  const { token } = useParams({ from: "/_authenticated/convite/$token" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [role, setRole] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [needsWedding, setNeedsWedding] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc("redeem_invite", { _token: token }).then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        setState("error");
        setMessage(error.message);
        return;
      }
      const redeemedRole = data as string;
      setRole(redeemedRole);
      if (redeemedRole === "owner") {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          const { data: mine } = await supabase
            .from("weddings")
            .select("id")
            .eq("owner_id", auth.user.id)
            .limit(1);
          if (active) setNeedsWedding((mine ?? []).length === 0);
        }
      }
      if (!active) return;
      setState("ok");
      queryClient.invalidateQueries({ queryKey: ["my-roles"] });
      queryClient.invalidateQueries({ queryKey: ["my-wedding"] });
    });
    return () => {
      active = false;
    };
  }, [token, queryClient]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card className="shadow-card">
          <CardHeader className="text-center">
            <CardTitle className="font-display text-3xl">Convite de acesso</CardTitle>
            <CardDescription>
              {state === "loading" && "Validando seu convite..."}
              {state === "ok" &&
                (role === "owner"
                  ? needsWedding
                    ? "Acesso liberado como noivos. Agora é só criar o casamento de vocês."
                    : "Acesso liberado como noivos. O casamento já está vinculado à sua conta."
                  : role === "admin"
                    ? "Acesso liberado como super administrador."
                    : "Acesso liberado como convidado.")}
              {state === "error" && message}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {state === "ok" && <CheckCircle2 className="size-10 text-accent" />}
            {state === "error" && <XCircle className="text-destructive size-10" />}
            {state === "ok" && (
              <Button
                onClick={() =>
                  navigate({
                    to: role === "guest" ? "/" : needsWedding ? "/criar-conta" : "/painel",
                    replace: true,
                  })
                }
              >
                {role === "guest"
                  ? "Ir para o site"
                  : needsWedding
                    ? "Criar nosso casamento"
                    : "Ir para a área dos noivos"}
              </Button>
            )}
            {state === "error" && (
              <Button variant="outline" onClick={() => navigate({ to: "/" })}>
                Voltar ao início
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

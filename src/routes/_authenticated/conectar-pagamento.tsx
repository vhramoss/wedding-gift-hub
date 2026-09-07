import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { completeMpConnect } from "@/lib/mp-oauth.functions";

const searchSchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/conectar-pagamento")({
  validateSearch: searchSchema,
  component: ConectarPagamento,
  head: () => ({
    meta: [
      { title: "Conectar conta de recebimento | Casa Comigo" },
      {
        name: "description",
        content:
          "Conclua a conexão da conta de recebimento dos presentes do seu casamento.",
      },
      { property: "og:title", content: "Conectar conta de recebimento" },
      {
        property: "og:description",
        content:
          "Conclua a conexão da conta de recebimento dos presentes do seu casamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ConectarPagamento() {
  const { code, state, error } = Route.useSearch();
  const navigate = useNavigate();
  const complete = useServerFn(completeMpConnect);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Concluindo a conexão…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (error) {
      setStatus("error");
      setMessage("A autorização foi cancelada no Mercado Pago.");
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Link de retorno inválido. Tente conectar novamente.");
      return;
    }
    complete({ data: { code, weddingId: state } })
      .then(() => {
        setStatus("ok");
        setMessage("Conta conectada com sucesso!");
        setTimeout(() => navigate({ to: "/painel" }), 1500);
      })
      .catch((e: Error) => {
        setStatus("error");
        setMessage(e.message || "Não foi possível concluir a conexão.");
      });
  }, [code, state, error, complete, navigate]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Conta de recebimento</h1>
      <p
        className={
          status === "error" ? "text-destructive" : "text-muted-foreground"
        }
      >
        {message}
      </p>
      {status !== "loading" ? (
        <Button asChild variant="outline">
          <Link to="/painel">Voltar ao painel</Link>
        </Button>
      ) : null}
    </main>
  );
}

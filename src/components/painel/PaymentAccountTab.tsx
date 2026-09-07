import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  disconnectWeddingMp,
  getMpConnectUrl,
  getWeddingPaymentStatus,
} from "@/lib/mp-oauth.functions";

export function PaymentAccountTab({ weddingId }: { weddingId: string | null }) {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getWeddingPaymentStatus);
  const connectUrl = useServerFn(getMpConnectUrl);
  const disconnect = useServerFn(disconnectWeddingMp);

  const statusQuery = useQuery({
    queryKey: ["panel", "payment-account", weddingId],
    enabled: Boolean(weddingId),
    queryFn: () => fetchStatus({ data: { weddingId: weddingId! } }),
  });

  const connectMutation = useMutation({
    mutationFn: async () => connectUrl({ data: { weddingId: weddingId! } }),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => disconnect({ data: { weddingId: weddingId! } }),
    onSuccess: () => {
      toast.success("Conta desconectada.");
      queryClient.invalidateQueries({
        queryKey: ["panel", "payment-account", weddingId],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = statusQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conta que recebe os presentes</CardTitle>
        <CardDescription>
          Conecte a conta Mercado Pago de vocês. Assim, cada presente pago cai
          direto na conta de vocês, já com a taxa da plataforma descontada
          automaticamente no momento do pagamento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !status?.configured ? (
          <p className="text-sm text-muted-foreground">
            A conexão de contas ainda não foi liberada. Fale com a equipe do
            site.
          </p>
        ) : status.connected ? (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Conta conectada
              </p>
              <p className="text-muted-foreground">
                Identificador da conta: {status.mpUserId ?? "—"}
                {status.liveMode === false ? " (conta de teste)" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
              >
                Reconectar
              </Button>
              <Button
                variant="destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Nenhuma conta conectada ainda. Enquanto isso, os pagamentos ficam
              na conta da plataforma e o repasse é feito manualmente.
            </p>
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? "Abrindo…" : "Conectar conta Mercado Pago"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useEffect, useRef, useState } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";

type CardData = {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
};

type Props = {
  publicKey: string;
  amount: number;
  onSubmit: (data: CardData) => void | Promise<void>;
  onError?: (message: string) => void;
};

/**
 * Brick de cartão do Mercado Pago. Tokeniza os dados do cartão no próprio
 * iframe do MP — o número/CVV nunca passa pelo nosso servidor.
 * Renderizado via React.lazy (client-only) para evitar execução em SSR.
 */
export default function MercadoPagoCardPayment({
  publicKey,
  amount,
  onSubmit,
  onError,
}: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (!publicKey) {
      setFailed("Chave pública do Mercado Pago não configurada.");
      return;
    }
    try {
      initMercadoPago(publicKey, { locale: "pt-BR" });
      setReady(true);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "Falha ao iniciar Mercado Pago");
    }
  }, [publicKey]);

  if (failed) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium">Não foi possível carregar o formulário do cartão.</p>
        <p className="mt-1 text-muted-foreground">
          As credenciais de cartão do Mercado Pago precisam ser revisadas pelo
          administrador do site. Você ainda pode presentear pelo Pix.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{failed}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Carregando pagamento por cartão…
      </div>
    );
  }

  return (
    <CardPayment
      initialization={{ amount }}
      onError={(e) => {
        setFailed(
          typeof e === "object" && e && "message" in e
            ? String((e as { message?: unknown }).message)
            : "Erro ao carregar o formulário do cartão.",
        );
        onError?.("Formulário do cartão indisponível.");
      }}
      onSubmit={async (param) => {
        const token = param.token;
        if (!token) {
          onError?.("Não foi possível gerar o token do cartão.");
          return;
        }
        await onSubmit({
          token,
          paymentMethodId: param.payment_method_id,
          issuerId: param.issuer_id ?? "",
          installments: param.installments ?? 1,
        });
      }}
    />
  );

}

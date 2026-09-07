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
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    try {
      initMercadoPago(publicKey);
      setReady(true);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Falha ao iniciar Mercado Pago");
    }
  }, [publicKey, onError]);

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

import { useEffect, useRef, useState } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import type { PaymentMethod } from "@/lib/br";

type CardData = {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
};

type Props = {
  publicKey: string;
  amount: number;
  paymentMethod: Extract<PaymentMethod, "credit" | "debit">;
  onSubmit: (data: CardData) => void | Promise<void>;
  onError?: (message: string) => void;
};

/**
 * Brick oficial do Mercado Pago.
 * Os dados do cartão são digitados/tokenizados no ambiente do Mercado Pago;
 * número e CVV não são salvos nem enviados ao nosso banco/servidor.
 */
export default function MercadoPagoCardPayment({
  publicKey,
  amount,
  paymentMethod,
  onSubmit,
  onError,
}: Props) {
  const [ready, setReady] = useState(false);
  const initRef = useRef<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      onError?.("Chave pública do Mercado Pago não configurada.");
      return;
    }

    if (initRef.current === publicKey) {
      setReady(true);
      return;
    }

    try {
      initMercadoPago(publicKey);
      initRef.current = publicKey;
      setReady(true);
    } catch (e) {
      onError?.(
        e instanceof Error ? e.message : "Falha ao iniciar Mercado Pago",
      );
    }
  }, [publicKey, onError]);

  if (!ready) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Carregando pagamento por{" "}
        {paymentMethod === "debit" ? "débito" : "crédito"}…
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
          installments:
            paymentMethod === "debit"
              ? 1
              : Math.max(1, Math.min(12, param.installments ?? 1)),
        });
      }}
    />
  );
}
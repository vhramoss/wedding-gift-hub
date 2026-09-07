import { useEffect, useRef, useState } from "react";

type CardData = {
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
};

type Props = {
  publicKey: string;
  amount: number;
  maxInstallments?: number;
  onSubmit: (data: CardData) => void | Promise<void>;
  onError?: (message: string) => void;
};

const SDK_SRC = "https://sdk.mercadopago.com/js/v2";

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as unknown as { MercadoPago?: unknown };
  if (w.MercadoPago) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar o Mercado Pago")));
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar o Mercado Pago"));
    document.head.appendChild(s);
  });
}

/**
 * Formulário (Brick) de cartão do Mercado Pago montado diretamente com o SDK v2.
 * Os dados sensíveis ficam no iframe do MP — número e CVV nunca passam pelo servidor.
 */
export default function MercadoPagoCardPayment({
  publicKey,
  amount,
  maxInstallments = 12,
  onSubmit,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);
  const submitRef = useRef(onSubmit);
  const errorRef = useRef(onError);
  submitRef.current = onSubmit;
  errorRef.current = onError;

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    if (!publicKey) {
      setFailed("Chave pública do Mercado Pago não configurada.");
      return;
    }

    let controller: { unmount?: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        await loadSdk();
        if (cancelled) return;
        const MP = (window as unknown as { MercadoPago: new (k: string, o?: unknown) => any })
          .MercadoPago;
        const mp = new MP(publicKey, { locale: "pt-BR" });
        controller = await mp.bricks().create("cardPayment", "mp-card-brick", {
          initialization: { amount },
          customization: {
            paymentMethods: { maxInstallments },
            visual: { style: { theme: "default" } },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onError: (e: unknown) => {
              const msg =
                typeof e === "object" && e && "message" in e
                  ? String((e as { message?: unknown }).message)
                  : "Erro no formulário do cartão.";
              errorRef.current?.(msg);
            },
            onSubmit: async (formData: any) => {
              const token = formData?.token;
              if (!token) {
                errorRef.current?.("Não foi possível gerar o token do cartão.");
                return;
              }
              await submitRef.current({
                token,
                paymentMethodId: formData.payment_method_id,
                issuerId: formData.issuer_id ? String(formData.issuer_id) : "",
                installments: formData.installments ?? 1,
              });
            },
          },
        });
      } catch (e) {
        if (!cancelled) {
          setFailed(e instanceof Error ? e.message : "Falha ao iniciar o Mercado Pago.");
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        controller?.unmount?.();
      } catch {
        /* noop */
      }
    };
  }, [publicKey, amount, maxInstallments]);

  if (failed) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium">Não foi possível carregar o formulário do cartão.</p>
        <p className="mt-1 text-muted-foreground">
          Você ainda pode presentear pelo Pix enquanto isso.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{failed}</p>
      </div>
    );
  }

  return (
    <div>
      {!ready ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Carregando formulário do cartão…
        </div>
      ) : null}
      <div id="mp-card-brick" ref={containerRef} />
    </div>
  );
}

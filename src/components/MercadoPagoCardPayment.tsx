import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

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
    if (existing.dataset["loaded"] === "true") return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("O Mercado Pago demorou demais para responder.")),
        15000,
      );
      existing.addEventListener("load", () => {
        window.clearTimeout(timeout);
        existing.dataset["loaded"] = "true";
        resolve();
      }, { once: true });
      existing.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("Falha ao carregar o Mercado Pago."));
      }, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    const timeout = window.setTimeout(() => {
      s.remove();
      reject(new Error("O Mercado Pago demorou demais para responder."));
    }, 15000);
    s.onload = () => {
      window.clearTimeout(timeout);
      s.dataset["loaded"] = "true";
      resolve();
    };
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
  const reactId = useId();
  const containerId = `mp-card-${reactId.replace(/:/g, "")}`;
  const submitRef = useRef(onSubmit);
  const errorRef = useRef(onError);
  submitRef.current = onSubmit;
  errorRef.current = onError;

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!publicKey) {
      setFailed("Chave pública do Mercado Pago não configurada.");
      return;
    }

    let controller: { unmount?: () => void } | null = null;
    let cancelled = false;
    let readyTimeout: number | undefined;
    setReady(false);
    setFailed(null);

    (async () => {
      try {
        await loadSdk();
        if (cancelled) return;
        const MP = (window as unknown as {
          MercadoPago?: new (k: string, o?: unknown) => any;
        }).MercadoPago;
        if (!MP) throw new Error("O serviço de pagamento não iniciou corretamente.");
        const mp = new MP(publicKey, { locale: "pt-BR" });
        readyTimeout = window.setTimeout(() => {
          if (!cancelled) {
            setFailed("Não foi possível exibir os campos do cartão.");
            controller?.unmount?.();
          }
        }, 20000);
        controller = await mp.bricks().create("cardPayment", containerId, {
          initialization: { amount },
          customization: {
            paymentMethods: { maxInstallments },
            visual: { style: { theme: "default" } },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) {
                window.clearTimeout(readyTimeout);
                setReady(true);
              }
            },
            onError: (e: unknown) => {
              const msg =
                typeof e === "object" && e && "message" in e
                  ? String((e as { message?: unknown }).message)
                  : "Erro no formulário do cartão.";
              if (!cancelled) {
                window.clearTimeout(readyTimeout);
                setFailed(msg);
              }
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
          window.clearTimeout(readyTimeout);
          setFailed(e instanceof Error ? e.message : "Falha ao iniciar o Mercado Pago.");
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimeout);
      try {
        controller?.unmount?.();
      } catch {
        /* noop */
      }
    };
  }, [publicKey, amount, maxInstallments, containerId, attempt]);

  return (
    <div className="min-h-40">
      {failed ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-semibold">Não foi possível abrir os campos do cartão.</p>
              <p className="mt-1 text-muted-foreground">{failed}</p>
              <p className="mt-1 text-muted-foreground">
                Verifique sua conexão ou tente novamente. O pagamento por Pix continua disponível.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw className="size-4" />
            Tentar carregar novamente
          </Button>
        </div>
      ) : !ready ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span>Carregando os campos seguros do cartão…</span>
        </div>
      ) : null}
      <div id={containerId} className={failed ? "hidden" : "block"} />
    </div>
  );
}

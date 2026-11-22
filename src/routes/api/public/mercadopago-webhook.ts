import { createFileRoute } from "@tanstack/react-router";
import { PAYMENT_SERVICE_ORIGIN } from "@/lib/payment-service";

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: { handlers: { POST: async ({ request }) => forward(request), GET: async ({ request }) => forward(request) } },
});
async function forward(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers();
  for (const name of ["content-type", "x-signature", "x-request-id"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(`${PAYMENT_SERVICE_ORIGIN}/api/public/mercadopago-webhook${url.search}`, {
      method: request.method, headers, redirect: "manual", ...(request.method === "POST" ? { body: await request.text() } : {}),
    });
    return new Response(await response.text(), { status: response.status, headers: { "content-type": "text/plain" } });
  } catch {
    return new Response("Confirmação temporariamente indisponível", { status: 503 });
  }
}

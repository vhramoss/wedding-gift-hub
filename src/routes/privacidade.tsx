import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/SiteHeader";
import { BRAND, whatsappLink } from "@/lib/brand";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: `Política de privacidade · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Como tratamos dados pessoais de noivos e convidados (LGPD): quais dados coletamos, para que usamos, com quem compartilhamos e como exercer seus direitos.",
      },
      { property: "og:title", content: `Política de privacidade · ${BRAND.name}` },
      {
        property: "og:description",
        content: "Tratamento de dados pessoais de noivos e convidados conforme a LGPD.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="font-display text-3xl sm:text-4xl">Política de privacidade</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026.</p>
        <div className="divider-gold my-8 w-40" />

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              1. Controlador dos dados
            </h2>
            <p>
              {BRAND.full} é responsável pelo tratamento dos dados pessoais coletados nesta
              plataforma, nos termos da Lei nº 13.709/2018 (LGPD). Contato do encarregado: WhatsApp{" "}
              {BRAND.phoneDisplay}.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              2. Dados que coletamos
            </h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Noivos:</strong> nome, e-mail, telefone, dados
                do casamento (data, local, textos e fotos publicadas) e dados de recebimento.
              </li>
              <li>
                <strong className="text-foreground">Convidados:</strong> nome, e-mail, telefone,
                confirmação de presença, acompanhantes, restrições alimentares, recados e, quando há
                presente, CPF exigido pelo processador de pagamento.
              </li>
              <li>
                <strong className="text-foreground">Pagamentos:</strong> valor, forma de pagamento,
                parcelas, situação e identificador da transação. Números de cartão e código de
                segurança <strong className="text-foreground">não</strong> passam pelos nossos
                servidores nem são armazenados por nós.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              3. Para que usamos
            </h2>
            <p>
              Para criar e manter o site do casamento, autenticar acessos, registrar confirmações de
              presença, processar o pagamento dos presentes, prestar contas aos noivos, emitir
              documentos fiscais da comissão e prevenir fraudes. A base legal é a execução de
              contrato, o cumprimento de obrigação legal e o legítimo interesse na segurança.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              4. Com quem compartilhamos
            </h2>
            <p>
              Com o Mercado Pago (processamento de pagamento e divisão automática de valores), com o
              provedor de banco de dados e hospedagem utilizados para operar o site, e com os noivos
              do casamento em que você é convidado (nome, contato, confirmação e presente ofertado).
              Não vendemos dados pessoais.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              5. Por quanto tempo guardamos
            </h2>
            <p>
              Enquanto o site do casamento estiver ativo e, depois disso, pelo prazo necessário ao
              cumprimento de obrigações legais e fiscais (em regra, 5 anos para registros de
              pagamento). Depois, os dados são excluídos ou anonimizados.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">6. Seus direitos</h2>
            <p>
              Você pode pedir confirmação de tratamento, acesso, correção, portabilidade,
              anonimização e exclusão dos seus dados, além de revogar consentimentos. Faça o pedido
              pelo{" "}
              <a href={whatsappLink("Olá! Gostaria de tratar de um pedido sobre meus dados pessoais.")} target="_blank" rel="noopener noreferrer" className="underline">
                WhatsApp {BRAND.phoneDisplay}
              </a>
              . Respondemos em até 15 dias.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">7. Segurança</h2>
            <p>
              Os acessos são protegidos por senha, as páginas do casamento só ficam visíveis para
              pessoas autenticadas e as fotos ficam em armazenamento privado com links temporários.
              O banco de dados aplica regras de acesso por perfil (noivos, convidado e
              administrador).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">8. Cookies</h2>
            <p>
              Usamos apenas o armazenamento necessário para manter você conectado. Não utilizamos
              cookies de publicidade nem rastreamento de terceiros para fins de marketing.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm">
          Veja também os{" "}
          <Link to="/termos" className="underline">
            Termos de uso
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

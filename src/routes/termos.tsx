import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: `Termos de uso · ${BRAND.name}` },
      {
        name: "description",
        content:
          "Condições de uso da plataforma de sites de casamento e lista de presentes: contas, pagamentos, comissão e responsabilidades.",
      },
      { property: "og:title", content: `Termos de uso · ${BRAND.name}` },
      {
        property: "og:description",
        content: "Regras de uso da plataforma, pagamentos dos presentes e responsabilidades.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="font-display text-3xl sm:text-4xl">Termos de uso</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última atualização: setembro de 2026.</p>
        <div className="divider-gold my-8 w-40" />

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">1. Quem somos</h2>
            <p>
              {BRAND.full} ("plataforma") oferece a criação de sites de casamento com páginas
              personalizáveis, confirmação de presença e lista de presentes com pagamento online.
              Contato: WhatsApp {BRAND.phoneDisplay}.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">2. Contas</h2>
            <p>
              Existem três tipos de acesso: administrador da plataforma, noivos (donos de um
              casamento) e convidados. Cada pessoa é responsável por manter a senha em sigilo e por
              tudo o que for feito com o seu acesso. Contas de convidados são criadas por convite
              dos noivos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              3. Conteúdo publicado pelos noivos
            </h2>
            <p>
              Textos, fotos e a lista de presentes são de responsabilidade dos noivos, que declaram
              ter autorização para publicar as imagens e os nomes utilizados. A plataforma pode
              remover conteúdo ilegal, ofensivo ou que viole direitos de terceiros.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              4. Presentes e pagamentos
            </h2>
            <p>
              Os pagamentos são processados pelo Mercado Pago (Pix, cartão de débito à vista e
              cartão de crédito em até 12x). A plataforma não armazena números de cartão: os dados
              são enviados diretamente ao processador de pagamento.
            </p>
            <p>
              O valor de cada presente é definido pelos noivos. Sobre cada presente pago incide a
              comissão da plataforma, informada ao casal antes da publicação do site. Quando a conta
              de recebimento dos noivos está conectada, o valor líquido é depositado diretamente na
              conta deles e a comissão na conta da plataforma, no momento da liquidação. Sem essa
              conexão, o repasse é feito manualmente pela plataforma.
            </p>
            <p>
              Prazos de liberação, antecipação e taxas de parcelamento seguem as regras do
              Mercado Pago.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              5. Cancelamento e estorno
            </h2>
            <p>
              Presentes são contribuições voluntárias a um casal e, por isso, não há devolução
              automática. Pedidos recusados, cancelados ou estornados pelo Mercado Pago são
              atualizados automaticamente no site e o presente volta a ficar disponível. Casos
              excepcionais podem ser tratados pelo WhatsApp {BRAND.phoneDisplay}.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">
              6. Disponibilidade e responsabilidade
            </h2>
            <p>
              Trabalhamos para manter o site disponível, mas podem ocorrer interrupções por
              manutenção ou por falhas de serviços de terceiros (hospedagem, processador de
              pagamento). A plataforma não se responsabiliza por danos indiretos nem por
              indisponibilidades fora do seu controle.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">7. Encerramento</h2>
            <p>
              Os noivos podem solicitar a exclusão do site a qualquer momento. A plataforma pode
              encerrar acessos em caso de fraude, uso indevido ou descumprimento destes termos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl text-foreground sm:text-2xl">8. Foro e contato</h2>
            <p>
              Aplica-se a legislação brasileira. Dúvidas sobre estes termos podem ser enviadas pelo
              WhatsApp {BRAND.phoneDisplay}.
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm">
          Veja também a{" "}
          <Link to="/privacidade" className="underline">
            Política de privacidade
          </Link>
          .
        </p>
      </main>
    </div>
  );
}

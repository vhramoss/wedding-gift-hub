import { createFileRoute } from "@tanstack/react-router";

import { VendorDirectory } from "@/components/VendorDirectory";

export const Route = createFileRoute("/casamento/$slug/fornecedores")({
  head: ({ params }) => ({
    meta: [
      { title: `Fornecedores · Casamento de ${params.slug.replace(/-/g, " ")}` },
      {
        name: "description",
        content:
          "Fornecedores parceiros do casamento: buffet, fotografia, decoração, música e muito mais.",
      },
      { property: "og:title", content: "Fornecedores parceiros do casamento" },
      {
        property: "og:description",
        content: "Conheça os parceiros que ajudam a realizar este casamento.",
      },
    ],
  }),
  component: VendorsPage,
});

function VendorsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="text-center">
        <h1 className="font-display text-4xl">Fornecedores parceiros</h1>
        <div className="divider-gold mx-auto my-6 w-32" />
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Profissionais que trabalham com a gente e podem ajudar você também.
        </p>
      </div>
      <div className="mt-12">
        <VendorDirectory message="Olá! Vi o anúncio de vocês no site do casamento e gostaria de um orçamento." />
      </div>
    </div>
  );
}

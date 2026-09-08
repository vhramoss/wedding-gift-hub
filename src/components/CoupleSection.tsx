type Props = {
  brideName: string;
  groomName: string;
  bridePhotoUrl?: string | null;
  groomPhotoUrl?: string | null;
  intro?: string | null;
};

/** Raminho decorativo usado entre os títulos. */
export function BranchOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 40"
      aria-hidden="true"
      className={`mx-auto h-8 w-32 text-accent ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
    >
      <path d="M8 32 C 45 30, 70 20, 80 12 C 90 20, 115 30, 152 32" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={`l-${i}`}>
          <path d={`M${24 + i * 12} ${31 - i * 2.4} c -4 -6, -2 -10, 3 -11`} />
          <path d={`M${24 + i * 12} ${31 - i * 2.4} c 3 -6, 8 -7, 12 -5`} />
        </g>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={`r-${i}`}>
          <path d={`M${136 - i * 12} ${31 - i * 2.4} c 4 -6, 2 -10, -3 -11`} />
          <path d={`M${136 - i * 12} ${31 - i * 2.4} c -3 -6, -8 -7, -12 -5`} />
        </g>
      ))}
    </svg>
  );
}

export function CoupleSection({ brideName, groomName, bridePhotoUrl, groomPhotoUrl, intro }: Props) {
  if (!bridePhotoUrl && !groomPhotoUrl && !intro) return null;

  return (
    <section className="mt-20 text-center">
      <BranchOrnament />
      <h2 className="mt-6 font-display text-xl uppercase tracking-[0.28em] text-primary sm:text-3xl">
        Estamos prestes a realizar o nosso sonho!
      </h2>
      <BranchOrnament className="mt-6" />
      <h3 className="mt-6 font-display text-2xl uppercase tracking-[0.35em] text-primary sm:text-3xl">
        O casal
      </h3>

      <div className="mt-10 flex flex-wrap items-start justify-center gap-8 sm:gap-12">
        {[
          { name: groomName, url: groomPhotoUrl, label: "Ele" },
          { name: brideName, url: bridePhotoUrl, label: "Ela" },
        ]
          .filter((p) => p.url)
          .map((p) => (
            <figure key={p.label} className="w-40 sm:w-64">
              <img
                src={p.url!}
                alt={p.name}
                loading="lazy"
                className="aspect-square w-full rounded-full object-cover shadow-lg"
              />
              <figcaption className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {p.label} · {p.name}
              </figcaption>
            </figure>
          ))}
      </div>

      {intro ? (
        <p className="mx-auto mt-10 max-w-3xl whitespace-pre-line text-center text-base italic leading-relaxed text-muted-foreground sm:text-lg">
          {intro}
        </p>
      ) : null}
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play } from "lucide-react";

type Props = {
  url: string | null | undefined;
  title?: string | null;
  autoplay?: boolean | null;
};

/** Tocador de música do site do casal, com botão de pausar sempre visível. */
export function SiteMusic({ url, title, autoplay }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!url || !autoplay) return;
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      void audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    };
    tryPlay();

    // Navegadores só liberam o som após um toque na tela.
    const once = () => {
      if (!audioRef.current?.paused) return;
      tryPlay();
    };
    window.addEventListener("pointerdown", once, { once: true });
    return () => window.removeEventListener("pointerdown", once);
  }, [url, autoplay]);

  if (!url) return null;

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <audio ref={audioRef} src={url} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar a música" : "Tocar a música"}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border/70 bg-background/90 px-4 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-primary"
      >
        {playing ? <Pause className="size-4 text-accent" /> : <Play className="size-4 text-accent" />}
        <Music className="size-4" />
        <span className="hidden sm:inline">{title || (playing ? "Pausar música" : "Tocar música")}</span>
      </button>
    </>
  );
}

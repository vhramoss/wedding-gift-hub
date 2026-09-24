import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, X } from "lucide-react";

type Props = {
  url: string | null | undefined;
  title?: string | null;
  autoplay?: boolean | null;
};

type Source =
  | { kind: "audio"; src: string }
  | { kind: "youtube"; id: string }
  | { kind: "spotify"; type: string; id: string };

function parseSource(raw: string): Source {
  const url = raw.trim();
  const yt =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) return { kind: "youtube", id: yt[1]! };
  const sp = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/i);
  if (sp) return { kind: "spotify", type: sp[1]!.toLowerCase(), id: sp[2]! };
  // Google Drive: converte link de compartilhamento em download direto
  const gd = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]+)/i);
  if (gd) return { kind: "audio", src: `https://drive.google.com/uc?export=download&id=${gd[1]!}` };
  // Dropbox: força arquivo direto
  if (/dropbox\.com/i.test(url)) {
    return { kind: "audio", src: url.replace(/[?&]dl=0/, "").replace(/(\?|$)/, (m) => (m === "?" ? "?raw=1&" : "?raw=1")) };
  }
  return { kind: "audio", src: url };
}

/** Tocador de música do site do casal: aceita MP3, YouTube e Spotify. */
export function SiteMusic({ url, title, autoplay }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<HTMLIFrameElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const source = url ? parseSource(url) : null;

  const ytCmd = (func: "playVideo" | "pauseVideo") =>
    ytRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");

  useEffect(() => {
    if (!source || !autoplay) return;
    if (source.kind === "spotify") return;

    const tryPlay = () => {
      if (source.kind === "youtube") {
        ytCmd("playVideo");
        setPlaying(true);
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    const t = setTimeout(tryPlay, 800);
    // Navegadores só liberam o som após um toque na tela.
    const once = () => tryPlay();
    window.addEventListener("pointerdown", once, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", once);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, autoplay]);

  if (!source) return null;

  function toggle() {
    if (!source) return;
    if (source.kind === "spotify") {
      setSpotifyOpen((v) => !v);
      return;
    }
    if (source.kind === "youtube") {
      ytCmd(playing ? "pauseVideo" : "playVideo");
      setPlaying(!playing);
      return;
    }
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
      {source.kind === "audio" && <audio ref={audioRef} src={source.src} loop preload="auto" />}
      {source.kind === "youtube" && (
        <iframe
          ref={ytRef}
          title="Música do casal"
          src={`https://www.youtube.com/embed/${source.id}?enablejsapi=1&loop=1&playlist=${source.id}&controls=0&playsinline=1`}
          allow="autoplay; encrypted-media"
          className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0"
        />
      )}
      {source.kind === "spotify" && (
        <div
          className={`fixed bottom-20 right-5 z-50 w-[300px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-xl shadow-lg transition-opacity ${
            spotifyOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <button
            type="button"
            onClick={() => setSpotifyOpen(false)}
            aria-label="Fechar player"
            className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1 text-muted-foreground"
          >
            <X className="size-3" />
          </button>
          <iframe
            title="Música do casal"
            src={`https://open.spotify.com/embed/${source.type}/${source.id}?utm_source=generator`}
            width="100%"
            height="152"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="border-0"
          />
        </div>
      )}
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

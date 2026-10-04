import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Request = { file: File; resolve: (f: File | null) => void };
let open: ((r: Request) => void) | null = null;

/** Abre o enquadrador e devolve a foto recortada (ou a original). null = cancelado. */
export function requestImageCrop(file: File): Promise<File | null> {
  if (!open || file.type === "image/gif") return Promise.resolve(file);
  return new Promise((resolve) => open!({ file, resolve }));
}

const RATIOS = [
  { label: "Livre (original)", value: 0 },
  { label: "Horizontal 3:2", value: 3 / 2 },
  { label: "Quadrada", value: 1 },
  { label: "Vertical 4:5", value: 4 / 5 },
  { label: "Tela larga 16:9", value: 16 / 9 },
];

async function cropFile(file: File, src: string, area: Area): Promise<File> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  canvas.getContext("2d")!.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
}

export function ImageCropHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [src, setSrc] = useState("");
  const [natural, setNatural] = useState(1);
  const [ratio, setRatio] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    open = (r) => {
      const url = URL.createObjectURL(r.file);
      const probe = new Image();
      probe.onload = () => setNatural(probe.width / probe.height || 1);
      probe.src = url;
      setSrc(url);
      setRatio(0);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setReq(r);
    };
    return () => {
      open = null;
    };
  }, []);

  function close(result: File | null) {
    req?.resolve(result);
    if (src) URL.revokeObjectURL(src);
    setReq(null);
  }

  async function confirm() {
    if (!req) return;
    if (ratio === 0 && zoom === 1) return close(req.file);
    setBusy(true);
    try {
      close(area ? await cropFile(req.file, src, area) : req.file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(req)} onOpenChange={(o) => !o && close(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Enquadrar foto</DialogTitle>
          <DialogDescription>Arraste a foto e use o zoom para escolher a parte que vai aparecer.</DialogDescription>
        </DialogHeader>
        <div className="relative h-[55vh] max-h-[420px] w-full overflow-hidden rounded-lg bg-muted">
          {src ? (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              minZoom={1}
              maxZoom={4}
              aspect={ratio || natural}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setArea(px)}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {RATIOS.map((r) => (
            <Button key={r.label} type="button" size="sm" variant={ratio === r.value ? "default" : "outline"} onClick={() => setRatio(r.value)}>
              {r.label}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-sm">
          Zoom
          <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" />
        </label>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => close(null)}>Cancelar</Button>
          <Button type="button" onClick={confirm} disabled={busy}>{busy ? "Preparando..." : "Usar esta foto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

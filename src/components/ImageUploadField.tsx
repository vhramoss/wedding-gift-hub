import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadWeddingImage } from "@/lib/upload";

type Props = {
  label: string;
  value: string;
  weddingId: string;
  onChange: (url: string) => void;
  hint?: string;
};

export function ImageUploadField({ label, value, weddingId, onChange, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { url } = await uploadWeddingImage(file, weddingId);
      onChange(url);
      toast.success("Foto enviada!");
    } catch (e) {
      toast.error("Não foi possível enviar a foto", { description: (e as Error).message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-start gap-4">
        <div className="size-24 shrink-0 overflow-hidden rounded-lg border bg-secondary/50">
          {value ? (
            <img src={value} alt={label} className="size-24 object-cover" />
          ) : (
            <div className="flex size-24 items-center justify-center">
              <ImagePlus className="size-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              Enviar foto
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
                <X className="size-4" /> Remover
              </Button>
            ) : null}
          </div>
          <Input
            value={value}
            placeholder="ou cole um link https://..."
            onChange={(e) => onChange(e.target.value)}
          />
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

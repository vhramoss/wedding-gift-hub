import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "wedding-media";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** Lado maior das fotos do site (sem recorte, a foto inteira é mantida). */
const MAX_SIDE = 2200;

/** Reduz o peso da foto mantendo a imagem inteira, sem cortar nada. */
async function standardizeImage(file: File): Promise<Blob> {
  if (typeof document === "undefined" || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}


/** Envia a imagem para o armazenamento e devolve uma URL válida por 10 anos. */
export async function uploadWeddingImage(file: File, weddingId: string) {
  if (!file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem.");
  if (file.size > 15 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 15 MB.");

  const prepared = await standardizeImage(file);
  const ext = prepared.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop()?.toLowerCase() ?? "jpg");
  const path = `${weddingId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, prepared, {
      cacheControl: "31536000",
      upsert: false,
      contentType: prepared.type || file.type,
    });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (signError || !data) throw signError ?? new Error("Não foi possível gerar o link da imagem.");

  return { url: data.signedUrl, path };
}

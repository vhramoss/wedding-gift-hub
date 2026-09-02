import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "wedding-media";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** Envia a imagem para o armazenamento e devolve uma URL válida por 10 anos. */
export async function uploadWeddingImage(file: File, weddingId: string) {
  if (!file.type.startsWith("image/")) throw new Error("Envie um arquivo de imagem.");
  if (file.size > 10 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 10 MB.");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${weddingId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, TEN_YEARS);
  if (signError || !data) throw signError ?? new Error("Não foi possível gerar o link da imagem.");

  return { url: data.signedUrl, path };
}

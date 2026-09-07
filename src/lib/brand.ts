/** Identidade da plataforma (marca do estúdio que vende os sites de casamento). */
export const BRAND = {
  name: "Casa Comigo",
  tagline: "Sites de casamento e lista de presentes",
  full: "Casa Comigo · Sites de casamento",
  phoneDisplay: "(19) 99270-2709",
  phoneE164: "5519992702709",
  whatsappMessage:
    "Vim pelo site e gostaria de fazer um orçamento e conhecer o trabalho de vocês",
};

export function whatsappLink(message = BRAND.whatsappMessage) {
  return `https://wa.me/${BRAND.phoneE164}?text=${encodeURIComponent(message)}`;
}

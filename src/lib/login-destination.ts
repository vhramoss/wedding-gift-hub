export function safeLoginPath(value?: string): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return null;
  return value === "/" || value.startsWith("/auth") ? null : value;
}

export function loginDestination(redirect: string | undefined, slug?: string | null) {
  return safeLoginPath(redirect) ?? (slug ? `/casamento/${encodeURIComponent(slug)}` : "/");
}
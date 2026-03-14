export const DEFAULT_SITE_URL = "https://jaguar-ai.vercel.app";

export function getSiteUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? DEFAULT_SITE_URL;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function absoluteUrl(path: string) {
  return new URL(path, `${getSiteUrl()}/`).toString();
}

export function buildPageTitle(title?: string) {
  return title ? `${title} | JaguarAI` : "JaguarAI";
}

export function buildPageDescription(description: string) {
  return description;
}

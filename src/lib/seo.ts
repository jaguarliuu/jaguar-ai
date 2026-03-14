import { DEFAULT_SITE_URL, resolveSiteConfig, toAbsoluteUrl } from "@/lib/site-config";

export function getSiteUrl() {
  return resolveSiteConfig(process.env).siteUrl ?? DEFAULT_SITE_URL;
}

export function absoluteUrl(path: string) {
  return toAbsoluteUrl(getSiteUrl(), path);
}

export function buildPageTitle(title?: string) {
  return title ? `${title} | JaguarAI` : "JaguarAI";
}

export function buildPageDescription(description: string) {
  return description;
}

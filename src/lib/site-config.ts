import type { NextConfig } from "next";

export const DEFAULT_SITE_URL = "https://jaguar-ai.vercel.app";

type EnvLike = Partial<Record<string, string | undefined>>;

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildGithubPagesSiteUrl(owner: string, basePath: string) {
  return trimTrailingSlash(`https://${owner}.github.io${basePath}`);
}

export function resolveSiteConfig(env: EnvLike = process.env) {
  const configuredSiteUrl = env.NEXT_PUBLIC_SITE_URL ?? env.SITE_URL;

  if (configuredSiteUrl) {
    return {
      basePath: "",
      assetPrefix: "",
      siteUrl: trimTrailingSlash(configuredSiteUrl),
    };
  }

  const repository = env.GITHUB_REPOSITORY;
  const isGithubActions = env.GITHUB_ACTIONS === "true";

  if (!isGithubActions || !repository) {
    return {
      basePath: "",
      assetPrefix: "",
      siteUrl: DEFAULT_SITE_URL,
    };
  }

  const [owner, repoName] = repository.split("/");

  if (!owner || !repoName) {
    return {
      basePath: "",
      assetPrefix: "",
      siteUrl: DEFAULT_SITE_URL,
    };
  }

  const isUserPagesRepo = repoName === `${owner}.github.io`;
  const basePath = isUserPagesRepo ? "" : `/${repoName}`;
  const assetPrefix = basePath ? `${basePath}/` : "";

  return {
    basePath,
    assetPrefix,
    siteUrl: buildGithubPagesSiteUrl(owner, basePath),
  };
}

export function toAbsoluteUrl(siteUrl: string, path: string) {
  const base = trimTrailingSlash(siteUrl);
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, `${base}/`).toString();
}

export function createNextConfig(env: EnvLike = process.env): NextConfig {
  const { basePath, assetPrefix } = resolveSiteConfig(env);

  return {
    output: "export",
    trailingSlash: true,
    images: {
      unoptimized: true,
    },
    ...(basePath
      ? {
          basePath,
          assetPrefix,
        }
      : {}),
  };
}

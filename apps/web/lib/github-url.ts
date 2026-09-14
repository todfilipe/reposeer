export type ParsedRepoUrl = { owner: string; repo: string };

export function parseGithubRepoUrl(raw: string): ParsedRepoUrl | null {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const [owner, repoSegment] = segments;
  const repo = repoSegment.endsWith(".git")
    ? repoSegment.slice(0, -4)
    : repoSegment;

  return { owner, repo };
}

export function buildGithubRepoUrl({ owner, repo }: ParsedRepoUrl): string {
  return `https://github.com/${owner}/${repo}`;
}

export function buildGithubFileUrl(
  { owner, repo }: ParsedRepoUrl,
  filePath: string,
  startLine: number | null,
  endLine: number | null
): string {
  const path = filePath.split("/").map(encodeURIComponent).join("/");
  const anchor =
    startLine === null ? "" : `#L${startLine}-L${endLine ?? startLine}`;

  return `https://github.com/${owner}/${repo}/blob/HEAD/${path}${anchor}`;
}

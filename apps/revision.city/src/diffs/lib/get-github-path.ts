import { getGitHubPathFromURL } from './get-github-path-from-url';

export function getGitHubPath(input: string): string | undefined {
  try {
    const parsedURL = new URL(input);
    return getGitHubPathFromURL(parsedURL);
  } catch {
    return undefined;
  }
}

export interface RemoteInfo {
  providerType: "github" | "azure-devops";
  owner: string;
  repo: string;
}

/**
 * Parses a git remote URL and extracts provider, owner, and repo.
 * Returns null for unrecognized URLs.
 *
 * Supported formats:
 *   GitHub SSH:      git@github.com:owner/repo[.git]
 *   GitHub HTTPS:    https://github.com/owner/repo[.git]
 *   Azure DevOps:    https://dev.azure.com/org/project/_git/repo[.git]
 *   Azure legacy:    https://org.visualstudio.com/[DefaultCollection/]project/_git/repo[.git]
 */
export function parseRemoteUrl(url: string): RemoteInfo | null {
  // GitHub SSH
  const githubSsh = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (githubSsh) {
    return { providerType: "github", owner: githubSsh[1], repo: githubSsh[2] };
  }

  // GitHub HTTPS
  const githubHttps = url.match(/^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/);
  if (githubHttps) {
    return { providerType: "github", owner: githubHttps[1], repo: githubHttps[2] };
  }

  // Azure DevOps HTTPS: https://dev.azure.com/org/project/_git/repo
  const azureNew = url.match(
    /^https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/(.+?)(?:\.git)?\/?$/,
  );
  if (azureNew) {
    return { providerType: "azure-devops", owner: azureNew[1], repo: azureNew[3] };
  }

  // Azure DevOps legacy: https://org.visualstudio.com/[DefaultCollection/]project/_git/repo
  const azureLegacy = url.match(
    /^https?:\/\/([^.]+)\.visualstudio\.com\/(?:DefaultCollection\/)?([^/]+)\/_git\/(.+?)(?:\.git)?\/?$/,
  );
  if (azureLegacy) {
    return { providerType: "azure-devops", owner: azureLegacy[1], repo: azureLegacy[3] };
  }

  return null;
}

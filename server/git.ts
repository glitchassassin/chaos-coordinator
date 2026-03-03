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
  const githubSsh = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(url);
  if (githubSsh) {
    return { providerType: "github", owner: githubSsh[1], repo: githubSsh[2] };
  }

  // GitHub HTTPS
  const githubHttps = /^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(url);
  if (githubHttps) {
    return { providerType: "github", owner: githubHttps[1], repo: githubHttps[2] };
  }

  // Azure DevOps HTTPS: https://dev.azure.com/org/project/_git/repo
  const azureNew =
    /^https?:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/(.+?)(?:\.git)?\/?$/.exec(url);
  if (azureNew) {
    return { providerType: "azure-devops", owner: azureNew[1], repo: azureNew[3] };
  }

  // Azure DevOps legacy: https://org.visualstudio.com/[DefaultCollection/]project/_git/repo
  const azureLegacy =
    /^https?:\/\/([^.]+)\.visualstudio\.com\/(?:DefaultCollection\/)?([^/]+)\/_git\/(.+?)(?:\.git)?\/?$/.exec(url);
  if (azureLegacy) {
    return { providerType: "azure-devops", owner: azureLegacy[1], repo: azureLegacy[3] };
  }

  return null;
}

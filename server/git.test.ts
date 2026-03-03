import { describe, it, expect } from "vitest";
import { parseRemoteUrl } from "./git.js";

describe("parseRemoteUrl", () => {
  describe("GitHub SSH", () => {
    it("parses owner/repo.git", () => {
      expect(parseRemoteUrl("git@github.com:owner/repo.git")).toEqual({
        providerType: "github",
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses owner/repo without .git", () => {
      expect(parseRemoteUrl("git@github.com:owner/repo")).toEqual({
        providerType: "github",
        owner: "owner",
        repo: "repo",
      });
    });

    it("preserves hyphenated names", () => {
      expect(parseRemoteUrl("git@github.com:my-org/my-repo.git")).toEqual({
        providerType: "github",
        owner: "my-org",
        repo: "my-repo",
      });
    });
  });

  describe("GitHub HTTPS", () => {
    it("parses https with .git", () => {
      expect(parseRemoteUrl("https://github.com/owner/repo.git")).toEqual({
        providerType: "github",
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses https without .git", () => {
      expect(parseRemoteUrl("https://github.com/owner/repo")).toEqual({
        providerType: "github",
        owner: "owner",
        repo: "repo",
      });
    });

    it("parses http (non-TLS)", () => {
      expect(parseRemoteUrl("http://github.com/owner/repo.git")).toEqual({
        providerType: "github",
        owner: "owner",
        repo: "repo",
      });
    });
  });

  describe("Azure DevOps HTTPS (dev.azure.com)", () => {
    it("parses standard URL", () => {
      expect(
        parseRemoteUrl("https://dev.azure.com/myorg/myproject/_git/myrepo"),
      ).toEqual({
        providerType: "azure-devops",
        owner: "myorg",
        repo: "myrepo",
      });
    });

    it("parses URL with .git suffix", () => {
      expect(
        parseRemoteUrl("https://dev.azure.com/myorg/myproject/_git/myrepo.git"),
      ).toEqual({
        providerType: "azure-devops",
        owner: "myorg",
        repo: "myrepo",
      });
    });

    it("uses org as owner, ignores project segment", () => {
      expect(
        parseRemoteUrl("https://dev.azure.com/contoso/MyProject/_git/WebApp"),
      ).toEqual({
        providerType: "azure-devops",
        owner: "contoso",
        repo: "WebApp",
      });
    });
  });

  describe("Azure DevOps legacy (visualstudio.com)", () => {
    it("parses standard legacy URL", () => {
      expect(
        parseRemoteUrl("https://myorg.visualstudio.com/myproject/_git/myrepo"),
      ).toEqual({
        providerType: "azure-devops",
        owner: "myorg",
        repo: "myrepo",
      });
    });

    it("parses legacy URL with DefaultCollection", () => {
      expect(
        parseRemoteUrl(
          "https://myorg.visualstudio.com/DefaultCollection/myproject/_git/myrepo",
        ),
      ).toEqual({
        providerType: "azure-devops",
        owner: "myorg",
        repo: "myrepo",
      });
    });

    it("parses legacy URL with .git suffix", () => {
      expect(
        parseRemoteUrl(
          "https://contoso.visualstudio.com/DefaultCollection/MyProject/_git/WebApp.git",
        ),
      ).toEqual({
        providerType: "azure-devops",
        owner: "contoso",
        repo: "WebApp",
      });
    });
  });

  describe("unrecognized URLs", () => {
    it("returns null for GitLab", () => {
      expect(parseRemoteUrl("https://gitlab.com/owner/repo.git")).toBeNull();
    });

    it("returns null for Bitbucket", () => {
      expect(parseRemoteUrl("git@bitbucket.org:owner/repo.git")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseRemoteUrl("")).toBeNull();
    });

    it("returns null for plain text", () => {
      expect(parseRemoteUrl("not-a-url")).toBeNull();
    });
  });
});

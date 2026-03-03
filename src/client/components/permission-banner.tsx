import type { PermissionRequest } from "../types.js";

interface Props {
  permissions: PermissionRequest[];
  onReply: (requestId: string, reply: "once" | "always" | "reject") => void;
}

export function PermissionBanner({ permissions, onReply }: Props) {
  if (permissions.length === 0) return null;

  return (
    <div class="permission-stack">
      {permissions.map((perm) => {
        const description =
          typeof perm.metadata?.description === "string"
            ? perm.metadata.description
            : null;

        return (
          <div key={perm.id} class="permission-banner">
            <div class="permission-info">
              <span class="permission-label">Permission: {perm.permission}</span>
              {perm.patterns.length > 0 && (
                <span class="permission-patterns">
                  {perm.patterns.join(", ")}
                </span>
              )}
              {description && (
                <span class="permission-desc">{description}</span>
              )}
            </div>
            <div class="permission-actions">
              <button
                class="btn btn-primary"
                onClick={() => onReply(perm.id, "once")}
              >
                Approve
              </button>
              <button
                class="btn"
                onClick={() => onReply(perm.id, "always")}
              >
                Always
              </button>
              <button
                class="btn"
                onClick={() => onReply(perm.id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

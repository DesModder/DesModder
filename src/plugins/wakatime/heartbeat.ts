// This script gets used in content and background scripts
import { HeartbeatResult } from "../../utils/messages";

export interface WindowHeartbeatOptions {
  graphName: string;
  graphURL: string;
  lineCount: number;
  isWrite: boolean;
}

export interface HeartbeatOptions extends WindowHeartbeatOptions {
  splitProjects: boolean;
  projectName: string;
  appId: string;
  appSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function sendHeartbeat(
  opts: HeartbeatOptions,
  sendResponse: (x: HeartbeatResult) => void
) {
  const data = {
    // This is background information for WakaTime to handle. These values need no change.
    language: "Desmos",
    category: "coding",
    type: "app",
    dependencies: [],
    time: Date.now() * 0.001,
    lines: opts.lineCount,
    lineno: null,
    cursorpos: null,
    is_write: opts.isWrite,

    // Everything below will show up in your Leaderboard.
    project: opts.splitProjects
      ? opts.graphName
      : // Defend against empty string
        opts.projectName || "Desmos Projects",
    entity: opts.graphURL,
    branch: opts.splitProjects ? null : opts.graphName,
  };

  if (!opts.appId || !opts.appSecret) {
    const missing: string[] = [];
    if (!opts.appId) missing.push("App ID");
    if (!opts.appSecret) missing.push("App Secret");
    sendResponse({
      type: "heartbeat-error",
      status: null,
      message: `${missing.join(" and ")} not provided. Visit \`https://wakatime.com/apps/\` to create an app`,
    });
    return;
  }
  if (!opts.accessToken) {
    sendResponse({
      type: "heartbeat-error",
      status: null,
      message: `There is no token currently initialized. Press "Click Here to Authorize" within DesModder > Integrations > WakaTime`,
    });
    return;
  }

  let action: "heartbeat" | "heartbeat-updated-token" | "needs-refresh";
  if (Date.now() < opts.expiresAt) {
    action = "heartbeat";
  } else {
    action = "needs-refresh";
  }

  if (action === "needs-refresh") {
    try {
      // Use the new credentials from now on.
      opts = await refreshToken(opts);
      action = "heartbeat-updated-token";
      sendResponse({
        type: "heartbeat-updated-token",
        updatedConfig: opts,
      });
    } catch (e) {
      sendResponse({
        type: "heartbeat-error",
        status: null,
        message:
          typeof e === "object" && e !== null ? ((e as any).message ?? e) : e,
      });
    }
  }

  if (action === "heartbeat" || action === "heartbeat-updated-token") {
    try {
      const r = await fetch(
        "https://wakatime.com/api/v1/users/current/heartbeats",
        {
          method: "POST",
          credentials: "omit",
          headers: {
            Authorization: `Bearer ${opts.accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );
      const text = await r.text();

      if (r.status !== 201) {
        sendResponse({
          type: "heartbeat-error",
          status: r.status,
          message: text,
        });
      }

      if (action === "heartbeat-updated-token") {
        sendResponse({
          type: "heartbeat-updated-token",
          updatedConfig: opts,
        });
      }
    } catch (e) {
      sendResponse({
        type: "heartbeat-error",
        status: null,
        message:
          typeof e === "object" && e !== null ? ((e as any).message ?? e) : e,
      });
    }
  }
}

/**
 * Exchange `opts.refreshToken` for a new access token.
 * Returns a copy of `opts` with the new access token, refresh token, and expiry.
 * Throws if the request fails or WakaTime rejects the refresh.
 */
async function refreshToken(opts: HeartbeatOptions): Promise<HeartbeatOptions> {
  const r = await fetch("https://wakatime.com/oauth/token", {
    method: "POST",
    credentials: "omit",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.appId,
      client_secret: opts.appSecret,
      redirect_uri: "https://www.desmos.com/calculator",
      grant_type: "refresh_token",
      refresh_token: opts.refreshToken,
    }),
  });
  const text = await r.text();
  if (!r.ok) {
    throw Error(`Failed to refresh WakaTime token: ${text}`);
  }
  const json = JSON.parse(text);

  const accessToken = json.access_token;
  const refreshToken = json.refresh_token;
  const expiresAt = json.expires_at;

  if (!accessToken || !refreshToken || !expiresAt) {
    const missing: string[] = [];
    if (!accessToken) missing.push("access_token");
    if (!refreshToken) missing.push("refresh_token");
    if (!expiresAt) missing.push("expires_at");
    throw Error(`Missing \`${missing.join(",")}\` from token refresh ${text}`);
  }

  return {
    ...opts,
    accessToken,
    refreshToken,
    expiresAt: new Date(expiresAt).getTime(),
  };
}

// This script gets used in content and background scripts
import { HeartbeatError } from "../../utils/messages";

export interface WindowHeartbeatOptions {
  graphName: string;
  graphURL: string;
  lineCount: number;
  isWrite: boolean;
}

export interface HeartbeatOptions extends WindowHeartbeatOptions {
  splitProjects: boolean;
  projectName: string;
  secretKey: string;
}

/**
 * If two of the same heartbeat are sent within this interval,
 * reject the second one.
 *
 * This isn't a concern for heartbeats from the same tab: each tab
 * throttles to one heartbeat every 120s. The concern is the user
 * opening different tabs containing the same graph, since each
 * would send their own (otherwise identical) heartbeat.
 */
const DEDUPE_THRESHOLD_MS = 110 * 1000;

interface LastHeartbeatObject {
  project: string;
  entity: string;
}

function isEqual(a: LastHeartbeatObject, b: LastHeartbeatObject) {
  return a.entity === b.entity && a.project === b.project;
}

class HeartbeatBackend {
  lastHeartbeatMs = 0;
  lastHeartbeatObject?: LastHeartbeatObject = undefined;

  private preparePayload(opts: HeartbeatOptions) {
    const dedupeObject: LastHeartbeatObject = {
      project: opts.splitProjects
        ? opts.graphName
        : // Defend against empty string
          opts.projectName || "Desmos Projects",
      entity: opts.graphURL,
    };

    const now = Date.now();
    if (
      this.lastHeartbeatMs > now - DEDUPE_THRESHOLD_MS &&
      this.lastHeartbeatObject &&
      isEqual(dedupeObject, this.lastHeartbeatObject)
    ) {
      return undefined;
    }

    this.lastHeartbeatMs = now;
    this.lastHeartbeatObject = dedupeObject;

    return {
      // This is background information for WakaTime to handle. These values need no change.
      language: "Desmos",
      category: "coding",
      type: "app",
      dependencies: [],
      time: now * 0.001,
      lines: opts.lineCount,
      lineno: null,
      cursorpos: null,
      is_write: opts.isWrite,

      // Everything below will show up in your Leaderboard.
      ...dedupeObject,
      branch: opts.splitProjects ? null : opts.graphName,
    };
  }

  public async sendHeartbeat(
    opts: HeartbeatOptions,
    sendResponse: (x: HeartbeatError) => void
  ) {
    if (opts.secretKey === "") {
      sendResponse({
        type: "heartbeat-error",
        isAuthError: true,
        message: "Secret key not provided",
      });
      return;
    }

    const data = this.preparePayload(opts);
    if (!data) {
      sendResponse({
        type: "heartbeat-error",
        isAuthError: false,
        message: "Duplicate heartbeat (same graph open in two tabs?). Ignored.",
      });
    }

    try {
      const r = await fetch(
        "https://wakatime.com/api/v1/users/current/heartbeats",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(opts.secretKey)}`,
            "content-type": "application/json",
          },
          credentials: "omit",
          body: JSON.stringify(data),
        }
      );
      if (r.status !== 201)
        sendResponse({
          type: "heartbeat-error",
          isAuthError: r.status === 401,
          message: await r.text(),
        });
    } catch (e) {
      sendResponse({
        type: "heartbeat-error",
        isAuthError: false,
        message:
          typeof e === "object" && e !== null ? ((e as any).message ?? e) : e,
      });
    }
  }
}

const backend = new HeartbeatBackend();

export async function sendHeartbeat(
  opts: HeartbeatOptions,
  sendResponse: (response: HeartbeatError) => void
) {
  await backend.sendHeartbeat(opts, sendResponse);
}

// This script gets used in content and background scripts
// TODO-waka: if two content scripts are open (i.e. Firefox), is that bad?
import { HeartbeatError } from "../../utils/messages";
import { IDBPDatabase, openDB } from "idb";

// Also given in globals/env.ts, but that doesn't apply to this file.
declare const VERSION: string;

export interface WindowHeartbeatOptions {
  graphName: string;
  graphURL: string;
  lineCount: number;
  isWrite: boolean;
}

export interface HeartbeatOptions extends WindowHeartbeatOptions {
  splitProjects: boolean;
  projectName: string;
  secretKey: string | undefined;
}

// TODO-waka: remove idb-keyval. The documentation for
// https://www.npmjs.com/package/idb has a few lines to replace it.

// TODO-waka: temp fast.
// const CACHE_CHECK_PERIOD_MINUTES = 120;
const CACHE_CHECK_PERIOD_SECONDS = 30;
const DUPLICATE_HEARTBEAT_THROTTLE_SECONDS = 1;

/* Some logic based on https://github.com/wakatime/browser-wakatime */
class HeartbeatBackend {
  private db: IDBPDatabase | undefined;
  // Start at 0, so it'll check the cache upon rebooting browser.
  private lastCacheCheck = 0;
  private lastHeartbeat = 0;

  private async setupDB() {
    if (this.db) return;
    this.db = await openDB("dsm-wakatime", 1, {
      upgrade(db) {
        db.createObjectStore("cacheHeartbeats", { keyPath: "time" });
      },
    });
  }

  private async getOperatingSystem(): Promise<string | undefined> {
    return await new Promise((resolve) => {
      // Firefox has browser.runtime.PlatformInfo, and more specifically,
      // it has browser.runtime.PlatformOs and browser.runtime.PlatformArch
      // But those don't seem to work (they give objects instead of strings).
      // So this only works in Chrome.
      const gpi = chrome.runtime?.getPlatformInfo;
      if (!gpi) {
        resolve(undefined);
        return;
      }
      gpi(function (info) {
        resolve(`${info.os}_${info.arch}`);
      });
    });
  }

  private async preparePayload(
    opts: HeartbeatOptions
  ): Promise<Record<string, unknown>> {
    const os = await this.getOperatingSystem();
    let userAgent;
    if (navigator.userAgent.includes("Firefox")) {
      userAgent = navigator.userAgent.match(/Firefox\/\S+/g)![0];
    } else if (navigator.userAgent.includes("Edg")) {
      userAgent = navigator.userAgent;
    } else {
      userAgent = navigator.userAgent.match(/Chrome\/\S+/g)![0];
    }

    const payload: Record<string, unknown> = {
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
      user_agent: `${userAgent} ${os} DesModder_wakatime/${VERSION}`,
    };

    return payload;
  }

  private async sendPostRequestToApi(
    payload: Record<string, unknown>,
    apiKey: string
  ): Promise<void> {
    try {
      const request: RequestInit = {
        body: JSON.stringify(payload),
        credentials: "omit",
        method: "POST",
      };
      const response = await fetch(
        `https://api.wakatime.com/api/v1/users/current/heartbeats?api_key=${apiKey}`,
        request
      );
      await response.json();
    } catch (err: unknown) {
      if (this.db) {
        await this.db.add("cacheHeartbeats", payload);
      }
    }
  }

  private async sendCachedHeartbeatsRequest(
    apiKey: string,
    sendResponse: (message: HeartbeatError) => void
  ): Promise<void> {
    if (!navigator.onLine) return;

    if (!apiKeyValid(apiKey)) {
      sendResponse(INVALID_KEY_RESPONSE);
      return;
    }
    if (!this.db) return;

    const requests = await this.db.getAll("cacheHeartbeats");
    await this.db.clear("cacheHeartbeats");
    const chunkSize = 50; // Create batches of max 50 request
    for (let i = 0; i < requests.length; i += chunkSize) {
      const chunk = requests.slice(i, i + chunkSize);
      const requestsPromises: Promise<void>[] = [];
      chunk.forEach((request: Record<string, unknown>) =>
        requestsPromises.push(this.sendPostRequestToApi(request, apiKey))
      );
      try {
        await Promise.all(requestsPromises);
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error("Error sending cached heartbeats");
      }
    }
  }

  async sendHeartbeat(
    heartbeat: HeartbeatOptions,
    sendResponse: (message: HeartbeatError) => void
  ): Promise<void> {
    if (!this.db) await this.setupDB();
    const apiKey = heartbeat.secretKey;
    if (!apiKeyValid(apiKey)) {
      sendResponse(INVALID_KEY_RESPONSE);
      return;
    }

    // Avoid duplicate heartbeat error, such as from quickly tabbing around
    // several Desmos tabs
    let now = new Date().getTime();
    if (
      now - this.lastHeartbeat <
      DUPLICATE_HEARTBEAT_THROTTLE_SECONDS * 1000
    ) {
      return;
    }
    this.lastHeartbeat = now;

    // Actually send heartbeat
    const payload = await this.preparePayload(heartbeat);
    await this.sendPostRequestToApi(payload, apiKey);

    // Check if we want to do cache
    now = new Date().getTime();
    if (now - this.lastCacheCheck > CACHE_CHECK_PERIOD_SECONDS * 1000) {
      this.lastCacheCheck = now;
      await this.sendCachedHeartbeatsRequest(apiKey, sendResponse);
    }
  }
}

const INVALID_KEY_RESPONSE: HeartbeatError = {
  type: "heartbeat-error",
  key: "invalid-api-key",
};

// TODO-waka: run this regex on the client field. Instant feedback
function apiKeyValid(key?: string): key is string {
  if (!key) return false;
  const re =
    /^(waka_)?[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
  return re.test(key);
}

const backend = new HeartbeatBackend();

export async function sendHeartbeat(
  opts: HeartbeatOptions,
  sendResponse: (response: HeartbeatError) => void
) {
  await backend.sendHeartbeat(opts, sendResponse);
}

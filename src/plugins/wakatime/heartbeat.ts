// This script gets used in content and background scripts

export interface HeartbeatOptions {
  graphName: string;
  graphURL: string;
  lineCount: number;
}

export async function sendHeartbeat(key: string, opts: HeartbeatOptions) {
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
    is_write: null,

    // Everything below will show up in your Leaderboard.
    project: opts.graphName,
    entity: opts.graphURL,
    branch: null,
  };

  void fetch("https://wakatime.com/api/v1/users/current/heartbeats", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(key)}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

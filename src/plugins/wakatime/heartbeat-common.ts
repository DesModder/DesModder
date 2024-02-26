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

// TODO-waka: run this regex on the client field. Instant feedback
export function apiKeyValid(key?: string): key is string {
  if (!key) return false;
  const re =
    /^(waka_)?[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
  return re.test(key);
}

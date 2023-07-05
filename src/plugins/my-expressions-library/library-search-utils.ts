import { GraphState } from "@desmodder/graph-state";

export async function getGraphState(
  hash: string
): Promise<{ state: GraphState; hash: string } | undefined> {
  try {
    const result = await (
      await fetch(`/calculator/${hash}`, {
        headers: { Accept: "application/json" },
      })
    ).json();
    return result;
  } catch {
    return undefined;
  }
}

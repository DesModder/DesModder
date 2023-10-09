import { GraphState } from "@desmodder/graph-state";

export async function getGraphState(
  link: string
): Promise<
  { state: GraphState; hash: string; title: string | null } | undefined
> {
  try {
    const result = await (
      await fetch(link, {
        headers: { Accept: "application/json" },
      })
    ).json();
    return result;
  } catch {
    return undefined;
  }
}

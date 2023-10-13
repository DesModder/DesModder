import { GraphState } from "@desmodder/graph-state";
import MyExpressionsLibrary from ".";

export async function getGraphState(
  link: string,
  plugin: MyExpressionsLibrary
): Promise<
  | { state: GraphState; hash: string; title: string | null; link: string }
  | undefined
> {
  try {
    const result = await (
      await fetch(link, {
        headers: { Accept: "application/json" },
      })
    ).json();
    if (result?.title) {
      plugin.setNameFromLink(link, result.title ?? "Untitled Graph");
    }
    return { ...result, link };
  } catch {
    return undefined;
  }
}

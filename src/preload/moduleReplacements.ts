import abstractItemView from "./moduleOverrides/abstract-item-view.replacements";
import parseReplacement, {
  ReplacementRule,
} from "./replacementHelpers/parseReplacement";

const replacements: Map<string, ReplacementRule> = new Map();

for (const replacement of [abstractItemView]) {
  const parsed = parseReplacement(replacement);
  const module = parsed.module;
  if (replacements.has(module))
    throw new Error(
      `Programming error: duplicate module replacement for ${module}`
    );
  replacements.set(module, parsed);
}

export default replacements;

import abstractItemView from "./moduleOverrides/abstract-item-view.replacements";
import abstractItem from "./moduleOverrides/abstract-item.replacements";
import actionsKeyboard from "./moduleOverrides/actions__keyboard.replacements";
import smartTextarea from "./moduleOverrides/smart_textarea.replacements";
import parseReplacement, {
  ReplacementRule,
} from "./replacementHelpers/parseReplacement";

const replacements: Map<string, ReplacementRule> = new Map();

const replacementStrings = [
  abstractItemView,
  smartTextarea,
  abstractItem,
  actionsKeyboard,
];

for (const replacement of replacementStrings) {
  const parsed = parseReplacement(replacement);
  const module = parsed.module;
  if (replacements.has(module))
    throw new Error(
      `Programming error: duplicate module replacement for ${module}`
    );
  replacements.set(module, parsed);
}

export default replacements;

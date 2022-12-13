import abstractItemView from "./moduleOverrides/abstract-item-view.replacements";

const replacements: Map<string, string> = new Map();

const IN_MODULE = "// in module ";

for (const replacement of [abstractItemView]) {
  const newlineIndex = replacement.indexOf("\n");
  const head = replacement.slice(0, newlineIndex);
  if (!head.startsWith(IN_MODULE))
    throw new Error("Replacement syntax error: missing '// in module '");
  const module = JSON.parse(head.slice(IN_MODULE.length));
  if (replacements.has(module))
    throw new Error(
      `Programming error: duplicate module replacement for ${module}`
    );
  const tail = replacement.slice(newlineIndex + 1);
  replacements.set(module, tail);
}

export default replacements;

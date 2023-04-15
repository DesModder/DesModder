import enFTL from "../../localization/en.ftl";
import esFTL from "../../localization/es.ftl";
import frFTL from "../../localization/fr.ftl";
import { FluentBundle, FluentResource, FluentVariable } from "@fluent/bundle";
import { Fragile } from "globals/window";

function currentLanguage() {
  return Fragile?.currentLanguage?.() ?? "en";
}

export const locales = new Map<string, FluentBundle>();

export function format(
  key: string,
  args?: Record<string, FluentVariable> | null | undefined,
  missingReplacement?: string | undefined
): string {
  const lang = currentLanguage();
  const bundle = locales.get(lang);
  const message = bundle?.getMessage(key);
  if (message?.value != null) {
    return bundle!.formatPattern(message.value, args);
  }
  if (missingReplacement === undefined)
    console.warn("[DesModder] Error formatting key", key, "in locale", lang);
  const englishBundle = locales.get("en")!;
  const englishMessage = englishBundle.getMessage(key);
  if (englishMessage?.value != null) {
    return englishBundle.formatPattern(englishMessage.value, args);
  }
  return missingReplacement ?? "";
}

/**
 * Add locale based on ftl string. The locale must be the same as Desmos's
 * locale string as returned by `currentLanguage()`
 */
function addLanguage(locale: string, ftl: string) {
  const resource = new FluentResource(ftl);
  const bundle = new FluentBundle(locale, { useIsolating: false });
  const errors = bundle.addResource(resource);
  if (errors.length) {
    console.warn("FTL translation file errors for locale " + locale, errors);
  }
  locales.set(locale, bundle);
}

addLanguage("en", enFTL);
addLanguage("es", esFTL);
addLanguage("fr", frFTL);

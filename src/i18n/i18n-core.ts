import enFTL from "../../localization/en.ftl";
import { FluentBundle, FluentResource, FluentVariable } from "@fluent/bundle";
import { Fragile } from "globals/window";

function currentLanguage() {
  return Fragile?.currentLanguage?.() ?? "en";
}

const locales = new Map<string, FluentBundle>();

export function format(
  key: string,
  args?: Record<string, FluentVariable> | null | undefined,
  missingReplacement?: string | undefined
): string {
  const lang = currentLanguage();
  const bundle = locales.get(lang) ?? locales.get("en")!;
  const message = bundle.getMessage(key);
  if (message === undefined || message.value === null) {
    if (missingReplacement === undefined)
      console.warn("Error formatting key", key, "in locale", lang);
    return missingReplacement ?? "";
  }
  return bundle.formatPattern(message.value, args);
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

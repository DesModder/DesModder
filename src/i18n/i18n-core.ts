import { FluentBundle, FluentResource, FluentVariable } from "@fluent/bundle";
import { Pattern } from "@fluent/bundle/esm/ast";
import { desmosRequire } from "globals/window";
import enFTL from "../../localization/en.ftl";

const { currentLanguage } = desmosRequire("lib/i18n-core") as {
  currentLanguage: () => string;
};

const locales = new Map<string, FluentBundle>();

/**
 * Add locale based on ftl string. The locale must be the same as Desmos's
 * locale string as returned by `require("lib/i18n-core").currentLanguage()`
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

export function format(
  key: string,
  args?: Record<string, FluentVariable> | null | undefined
) {
  const lang = currentLanguage();
  const bundle = locales.get(lang) ?? locales.get("en")!;
  const message = bundle.getMessage(key);
  if (message === undefined || message.value === null) {
    console.warn("Error formatting key ", key, "in locale", lang);
    return "";
  }
  return bundle.formatPattern(message.value, args);
}

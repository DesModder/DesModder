import enFTL from "./en.ftl";
import esFTL from "./es.ftl";
import frFTL from "./fr.ftl";
import jaFTL from "./ja.ftl";
import zhCNFTL from "./zh-CN.ftl";
import { FluentBundle, FluentResource, FluentVariable } from "@fluent/bundle";

export function currentLanguage() {
  return (window as any).Desmos?.Private?.Fragile?.currentLanguage?.() ?? "en";
}

export const locales = new Map<string, FluentBundle>();

const Console = console;

export function format(
  key: string,
  args?: Record<string, FluentVariable> | null | undefined,
  missingReplacement?: string | undefined
): string {
  const lang = currentLanguage();
  const bundle = locales.get(lang);
  if (bundle) {
    const message = bundle.getMessage(key);
    if (message?.value != null) {
      return bundle.formatPattern(message.value, args);
    }
    if (missingReplacement === undefined)
      Console.warn("[DesModder] Error formatting key", key, "in locale", lang);
  }
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
    Console.warn("FTL translation file errors for locale " + locale, errors);
  }
  locales.set(locale, bundle);
}

addLanguage("en", enFTL);
addLanguage("es", esFTL);
addLanguage("fr", frFTL);
addLanguage("ja", jaFTL);
addLanguage("zh-CN", zhCNFTL);

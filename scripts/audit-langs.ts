import { Message } from "@fluent/bundle";
import fs from "fs/promises";
import { locales } from "i18n/i18n-core";

void main();

async function main() {
  const args = process.argv.slice(2);
  const invalidLangs = args.filter((x) => !locales.has(x));
  if (invalidLangs.length > 0) {
    console.error(`Invalid languages specified: ${invalidLangs.join(", ")}`);
    console.error("Usage: 'npm run audit-langs' or 'npm run audit-langs fr'");
    process.exit(1);
  }
  const langs =
    args.length === 0 ? [...locales.keys()].filter((x) => x !== "en") : args;
  let good = true;
  for (const lang of langs) {
    good = (await compareLang(lang, await getUntranslatable(lang))) && good;
  }
  if (!good) process.exit(2);
}

async function getUntranslatable(lang: string) {
  const langFTL = (await fs.readFile(`localization/${lang}.ftl`)).toString();
  return new Set(
    langFTL
      .split(/#\s*unchanged.*\n/gi)
      .slice(1)
      .map((block) => block.split(/\n/)[0].split("=")[0].trim())
  );
}

async function compareLang(lang: string, expUnchanged: Set<string>) {
  console.log(`Comparing ${lang}.ftl to en.ftl...\n`);
  const enMessages = locales.get("en")!._messages;
  const langMessages = locales.get(lang)!._messages;
  // Check for missing
  let missing = false;
  for (const key of enMessages.keys()) {
    if (!langMessages.has(key)) {
      console.log(`Missing: ${key}`);
      missing = true;
    }
  }
  if (missing)
    console.log(`(Missing = included in en.ftl but not ${lang}.ftl)\n`);
  // Check for excess
  let excess = false;
  for (const key of langMessages.keys()) {
    if (!enMessages.has(key)) {
      console.log(`Excess: ${key}`);
      excess = true;
    }
  }
  if (excess)
    console.log(`(Excess = included in ${lang}.ftl but not en.ftl)\n`);
  // Check for unchanged
  let unchanged = false;
  for (const key of enMessages.keys()) {
    if (
      !expUnchanged.has(key) &&
      eqMessage(langMessages.get(key), enMessages.get(key))
    ) {
      console.log(`Unchanged: ${key}`);
      unchanged = true;
    }
  }
  if (unchanged)
    console.log(
      `(Unchanged = same definition in ${lang}.ftl and en.ftl. ` +
        `Add a comment '# Unchanged' before the definition ` +
        `in ${lang}.ftl if this is intended.)\n`
    );
  // Check for falsely unchanged
  let falselyUnchanged = false;
  for (const key of langMessages.keys()) {
    if (
      expUnchanged.has(key) &&
      !eqMessage(langMessages.get(key), enMessages.get(key))
    ) {
      console.log(`Falsely unchanged: ${key}`);
      falselyUnchanged = true;
    }
  }
  if (falselyUnchanged)
    console.log(
      `(Falsely unchanged = different definition in ${lang}.ftl and en.ftl, ` +
        `but comment '# Unchanged' is included at the end of the definition ` +
        `in ${lang}.ftl.)\n`
    );
  // wrap up
  const good = !missing && !excess && !unchanged && !falselyUnchanged;
  if (good) console.log("Looks all good!\n");
  return good;
}

function eqMessage(a: Message | undefined, b: Message | undefined) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* eslint-disable @typescript-eslint/no-require-imports */
const { mkdir, writeFile } = require("fs").promises;
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");

const DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");

function isHeadless() {
  const h = process.env.DSM_TESTING_HEADLESS;
  // Allow passing 'false' to make non-headless
  if (h === "false") return false;
  // Default to headless
  if (!h || h.trim() === "") return true;
  // 'true' does nothing.
  if (h === "true") return true;
  // Fallback could mean typo
  throw new Error(`Invalid DSM_TESTING_HEADLESS=${JSON.stringify(h)}`);
}

module.exports = async function () {
  const pathToExtension = path.join(process.cwd(), "dist");
  const browser = await puppeteer.launch({
    headless: isHeadless() ? "new" : false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });
  // store the browser instance so we can teardown it later
  // this global is only available in the teardown but not in TestEnvironments
  globalThis.__BROWSER_GLOBAL__ = browser;

  // use the file system to expose the wsEndpoint for TestEnvironments
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, "wsEndpoint"), browser.wsEndpoint());
};

/* eslint-disable @typescript-eslint/no-var-requires */
const { mkdir, writeFile } = require("fs").promises;
const os = require("os");
const path = require("path");
const puppeteer = require("puppeteer");

const DIR = path.join(os.tmpdir(), "jest_puppeteer_global_setup");

module.exports = async function () {
  const pathToExtension = path.join(process.cwd(), "dist");
  const browser = await puppeteer.launch({
    headless: "new",
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

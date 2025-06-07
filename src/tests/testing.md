## Overview

Use `npm run test` to run all tests.

Use `npm run test:unit -- textToAug -t Number` to run all tests containing "Number" in the file `textToAug.unit.test.ts`

## Unit tests

Create a unit test with `[name].unit.test.ts`.

Unit tests are ran in the "jsdom" environment, which simulates being in a browser.

Options have to be after an alone `--` to get passed to jest instead of npm.

- `npm run test:unit -- --watch` to re-run on changes
- `npm run test:unit -- --noStackTrace --verbose=false` to reduce sizes
- `npm run test:unit -- --coverage` to view unit test coverage
  - Open [`coverage/index.html`](../../coverage/index.html) in a browser to view more detailed coverage
  - On Mac, `open coverage/index.html`. On Linux-based, `xdg-open coverage/index.html`. Or navigate directly to `file:///home/username/DesModder/coverage/index.html` in a web browser.

## Writing Integration Tests

Create an integration test with `[name].int.test.ts`.

Do not import anything from files other than [`puppeteer-utils.ts`](./puppeteer-utils.ts), since the code runs in a node process, not inside the browser page. The exception is code inside functions like `driver.evaluate(() => Calc.setBlank())`. The callback gets stringified and ran inside the page.

Return `clean` if you've cleaned up the page (closed all the menus etc). This serves two purposes:

1. Makes sure that the UI can be cleaned up
2. Avoids the need to reload the page (saving some testing time). (Note: this only currently works within files. Separate test files are currently fully isolated).

Integration tests are ran in the "node" environment, since they control a browser from a node process but are not inside the browser.

If you get an error "TargetCloseError: Protocol error (Runtime.callFunctionOn): Target closed," you probably forgot an `await` somewhere.

## Running Integration Tests

If you want to see what happens during the tests, set the `DSM_TESTING_HEADLESS` environment variable to `false`, e.g.

```
DSM_TESTING_HEADLESS=false npm run test:integration
```

To test on different URLs, set the `DSM_TESTING_URL` environment variable, e.g.

```
DSM_TESTING_URL='https://desmos.com/calculator' npm run test:integration
```

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

## Integration tests

Create an integration test with `[name].int.test.ts`.

Integration tests are ran in the "node" environment, since they control a browser from a node process but are not inside the browser.

If you want to see what happens during the tests, edit `headless: "new"` to `headless: false` in [`puppeteer-utils.ts`](./puppeteer-utils.ts).

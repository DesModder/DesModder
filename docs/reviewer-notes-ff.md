The extension can be built with any relatively recent version of node and npm.
I built this with node v18.7.0 and npm 8.15.0 on Ubuntu 22.04.

Build process:

```
npm ci
npm run build-ff
```

Then the `dist` directory will contain the distributed code.

Eval is used exclusively within the webpage (for patching code) and does not have access to any web resources or the background extension context.

"Unsafe call to `document.createRange().createContextualFragment` for argument 0" is erroneous because the first argument is a constant hardcoded string. ESBuild just happens to not constant-collapse it.

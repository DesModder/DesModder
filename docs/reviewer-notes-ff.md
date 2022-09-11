The extension can be built with any relatively recent version of node and npm.
I built this with node v16.15.1 and npm 8.11.0 on Ubuntu 20.04, though
collaborators have built it on Windows.

Build process:

```
npm ci
npm run build-ff
```

Then the `dist` directory will contain the distributed code.

The Function constructor is used for eval exclusively within the webpage and does not have access to any web resources or the background extension context.

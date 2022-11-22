The extension can be built with any relatively recent version of node and npm.
I built this with node v18.7.0 and npm 8.15.0 on Ubuntu 22.04.

Build process:

```
npm ci
npm run build-ff
```

Then the `dist` directory will contain the distributed code.

The Function constructor is used for eval exclusively within the webpage and does not have access to any web resources or the background extension context.

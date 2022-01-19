const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const { merge } = require("webpack-merge");

baseConfig = (env) => ({
  resolve: {
    modules: ["node_modules", "src"],
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    fallback: {
      buffer: false,
      path: false,
      fs: false,
    },
  },
  entry: {
    background: "./src/background.ts",
    script: "./src/script.ts",
    preloadContent: "./src/preload/content.ts",
    preloadScript: "./src/preload/script.ts",
    workerAppend: "./src/worker/append.ts",
  },
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "[name].js",
    publicPath: "chrome-extension://__MSG_@@extension_id__/",
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
        exclude: /\.module\.css$/,
      },
      {
        test: /\.less$/,
        use: ["style-loader", "css-loader", "less-loader"],
      },
      {
        test: /\.[tj]sx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
      // https://stackoverflow.com/a/47514735/7481517
      {
        test: /\.(jpe?g|png|ttf|eot|svg|woff(2)?)(\?[a-z0-9=&.]+)?$/,
        use: "base64-inline-loader",
      },
    ],
  },
  devServer: {
    contentBase: "./dist",
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: `public/{${env.browser},common}/*`,
          to: "[name][ext]",
        },
      ],
    }),
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
    new webpack.DefinePlugin({
      BROWSER: JSON.stringify(env.browser),
    }),
  ],
  optimization: {
    // extension stores don't like minimized code? Faster approval?
    minimize: false,
  },
});

module.exports = (env, options) => {
  env.browser = env.browser === "firefox" ? "firefox" : "chrome";
  let config = baseConfig(env);
  if (options.mode === "development") {
    config = merge(config, {
      // can't use eval- in Manifest v3 extension
      devtool: "inline-cheap-module-source-map",
      watch: true,
      watchOptions: {
        ignored: /node_modules/,
      },
    });
  }
  return config;
};

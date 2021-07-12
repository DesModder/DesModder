const webpack = require("webpack");
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const config = {
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
    content: "./src/content.ts",
    script: "./src/script.ts",
    preloadContent: "./src/preload/content.ts",
    preloadScript: "./src/preload/script.ts",
  },
  output: {
    path: path.resolve(__dirname, "../dist"),
    filename: "[name].js",
    publicPath: "chrome-extension://__MSG_@@extension_id__/",
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
    contentBase: "../dist",
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: "public", to: "." }],
    }),
    new webpack.ProvidePlugin({
      process: "process/browser",
    }),
  ],
  optimization: {
    // extension stores don't like minimized code? Faster approval?
    minimize: false,
  },
};

module.exports = config;

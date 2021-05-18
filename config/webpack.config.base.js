const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

const config = {
  resolve: {
    modules: ["node_modules", "src"],
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  entry: {
    content: "./src/content.ts",
    script: "./src/script.ts",
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
    ],
  },
  devServer: {
    contentBase: "../dist",
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: "public", to: "." }],
    }),
  ],
  optimization: {
    // extension stores don't like minimized code? Faster approval?
    minimize: false,
  },
};

module.exports = config;

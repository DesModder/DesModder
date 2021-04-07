const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

const config = {
  resolve: {
    modules: ['node_modules', 'src'],
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  entry: {
    content: './src/content.ts',
    script: './src/script.ts',
    wolfram2desmos: './src/plugins/wolfram2desmos/wolfram2desmos.user.js'
  },
  output: {
    path: path.resolve(__dirname, '../dist'),
    filename: '[name].js',
    publicPath: 'chrome-extension://__MSG_@@extension_id__/',
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
        exclude: /\.module\.css$/,
      },
      {
        test: /\.[tj]sx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              modules: true,
            },
          },
        ],
        include: /\.module\.css$/,
      }
    ],
  },
  devServer: {
    contentBase: '../dist',
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: 'public', to: '.' }],
    }),
  ],
  optimization: {
    // extension stores don't like minimized code? Faster approval?
    minimize: false
  }
};

module.exports = config;

const { merge } = require('webpack-merge')
const webpackConfig = require('./webpack.config.base')

const cfg = merge(webpackConfig, {
  devtool: 'eval-source-map',
  watch: true,
  watchOptions: {
    ignored: /node_modules/
  }
})

module.exports = cfg

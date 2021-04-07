const { merge } = require('webpack-merge')
const webpackConfig = require('./webpack.config.base')

const cfg = merge(webpackConfig, {
  // can't use eval- in Manifest v3 extension
  devtool: 'inline-cheap-module-source-map',
  watch: true,
  watchOptions: {
    ignored: /node_modules/
  }
})

module.exports = cfg

const { merge } = require('webpack-merge')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

const UserScriptMetaDataPlugin = require('userscript-metadata-webpack-plugin')
const metadata = require('./metadata')

metadata.downloadURL = 'https://github.com/jared-hughes/DesModder/releases/latest/download/DesModder.user.js'
metadata.updateURL = 'https://github.com/jared-hughes/DesModder/releases/latest/download/DesModder.user.js'

const webpackConfig = require('./webpack.config.base')
const cfg = merge({}, webpackConfig, {
  entry: {
    DesModder: webpackConfig.entry
  },
  plugins: [
    new UserScriptMetaDataPlugin({
      metadata
    })
  ]
})

if (process.env.npm_config_report) {
  cfg.plugins.push(new BundleAnalyzerPlugin())
}

module.exports = cfg

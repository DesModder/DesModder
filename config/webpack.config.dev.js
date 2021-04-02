const path = require('path')
const webpack = require('webpack')
const { merge } = require('webpack-merge')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const LiveReloadPlugin = require('webpack-livereload-plugin')
const UserScriptMetaDataPlugin = require('userscript-metadata-webpack-plugin')
const metadata = require('./metadata')

const webpackConfig = require('./webpack.config.base')

metadata.require.push(
  'file://' + path.resolve(__dirname, '../dist/DesModder.user.js')
)
metadata.name += '-dev'

const cfg = merge(webpackConfig, {
  entry: {
    DesModder: webpackConfig.entry,
    'DesModder-dev': path.resolve(__dirname, './empty.js')
  },
  // https://webpack.js.org/configuration/devtool claims this is the slowest option
  // no reason to change for now though
  devtool: 'eval-source-map',
  watch: true,
  watchOptions: {
    ignored: /node_modules/
  },
  plugins: [
    new LiveReloadPlugin({
      delay: 500
    }),
    new UserScriptMetaDataPlugin({
      metadata
    }),
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(metadata.version + '-dev')
    })
  ]
})

if (process.env.npm_config_report) {
  cfg.plugins.push(new BundleAnalyzerPlugin())
}

module.exports = cfg

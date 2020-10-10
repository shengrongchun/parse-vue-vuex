const webpack = require('webpack')

module.exports = {
  configureWebpack: {
    plugins: [
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(true),
        'process.env': {
          NODE_ENV: JSON.stringify(process.env.NODE_ENV),
        }
      })
    ]
  }
}
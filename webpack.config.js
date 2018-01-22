const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = {
  entry: './app/main.js',
  output: {
    path: path.resolve(__dirname, './dist'),
    publicPath: '/dist/',
    filename: 'build.js'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'vue-style-loader',
          'css-loader'
        ],
      },      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
          }
          // other vue-loader options go here
        }
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      },
      {
        test: /\.(png|jpg|jpeg|gif|eot|ttf|woff|woff2|svg|svgz)(\?.+)?$/,
        use: [{
          loader: 'url-loader',
          options: {
            limit: 10000
          }
        }]
      }
    ]
  },
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.esm.js'
    },
    extensions: ['*', '.js', '.vue', '.json']
  },
  devServer: {
    historyApiFallback: true,
    noInfo: true,
    overlay: true
  },
  performance: {
    hints: false
  },
  devtool: '#eval-source-map'
}

if (process.env.NODE_ENV === 'production') {
  function isExternal(mdl, vendorName) {
    var context = mdl.context;
  
    if (typeof context !== 'string') {
      return false;
    }
  
    return context.indexOf('node_modules') !== -1 &&
      (!vendorName || context.indexOf(vendorName) !== -1);
  }

  module.exports.devtool = '#source-map';
  module.exports.entry = {
    ipfs: 'ipfs-api',
    element: 'element-ui',
    app: './app/main.js'
  };
  module.exports.output = {
    path: path.resolve(__dirname, './dist'),
    publicPath: '/dist/',
    filename: '[name].[chunkhash].js',
    chunkFilename: '[id].[chunkhash].js'
  };
  // http://vue-loader.vuejs.org/en/workflow/production.html
  module.exports.plugins = (module.exports.plugins || []).concat([
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: '"production"'
      }
    }),
    new HtmlWebpackPlugin({
      template: './app/index.html',
      filename: 'index.html',
      inject: 'body'
    }),
    // split vendor js into its own file
    new webpack.optimize.CommonsChunkPlugin({
      names: ['ipfs', 'element'],
      minChunks: Infinity
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'vendors',
      minChunks: function(mdl) {
        return isExternal(mdl);
      }
    }),
    // extract webpack runtime and module manifest to its own file in order to
    // prevent vendor hash from being updated whenever app bundle is updated
    // new webpack.optimize.CommonsChunkPlugin({
    //   name: 'manifest',
    //   chunks: ['vendor']
    // }),
    new UglifyJsPlugin({
      sourceMap: true,
      uglifyOptions: {
        ecma: 8,  
        compress: {
          warnings: false
        }
      }
    }),
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  ])
}

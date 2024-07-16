/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

process.env.NODE_ENV = 'prod';

const path = require('path');
const shared = require('./webpack.config.js');

const TerserPlugin = require("terser-webpack-plugin");

let innerConfig = 
{
    mode:'production',
    watch:false,
    //devtool:'source-map', //don't output source maps...for now
    optimization: 
    {
        minimize:true,
        minimizer:[new TerserPlugin({terserOptions:
            {
                mangle:{properties:false, keep_classnames:true, keep_fnames:true, module:true, toplevel:false}, 
                sourceMap:true, 
                compress:true,
                format: 
                {
                    comments: /@license/i,
                },
            },
            extractComments:false
        })],
    }
};


let config =
[
    {...innerConfig},
    {...innerConfig},
];

let array = [];
for (let i = 0, length = config.length; i < length; i++)
{
    let eachConfig = config[i];
    let eachShared = shared[i];

    array.push({...eachConfig, ...eachShared});
}

module.exports = array;
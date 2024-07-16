/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

process.env.NODE_ENV = 'dev';

const path = require('path');
const shared = require('./webpack.config.js');

let innerConfig = 
{
    mode:'development',
    watch:true,
    devtool:'inline-source-map',
};

let config =
[
    {...innerConfig},
    {...innerConfig}
];

let array = [];
for (let i = 0, length = config.length; i < length; i++)
{
    let eachConfig = config[i];
    let eachShared = shared[i];

    array.push({...eachConfig, ...eachShared});
}

module.exports = array;
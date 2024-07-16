/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

const path = require('path');

const ROOT_PATH = path.join(__dirname);

const ELECTRON_PATH = ROOT_PATH;
const ELECTRON_SOURCE_PATH = path.join(ELECTRON_PATH, '/src/');
const ELECTRON_MAIN_SOURCE_PATH = path.join(ELECTRON_SOURCE_PATH, '/');
const ELECTRON_BRIDGE_SOURCE_PATH = path.join(ELECTRON_SOURCE_PATH, '/library/bridge/');

const env = process.env.NODE_ENV;

module.exports =
[{
    devtool:'eval-source-map',
    entry:
    {
        main:path.join(ELECTRON_MAIN_SOURCE_PATH, 'Main.ts'),
    },
    output:
    {
        publicPath:'',
        compareBeforeEmit:true,
        path:ELECTRON_PATH,
        filename:"js/[name].bundle.js",
    },
    target:['electron-main'],
    experiments: //https://webpack.js.org/configuration/experiments/
    {
        topLevelAwait:true //dynamic import at the top of a class
    },
    resolve:
    {
        extensions:['.ts', '.js'],
    },
    externals:
    {
        fsevents:"require('fsevents')" //see https://github.com/yan-foto/electron-reload/issues/71
    },
    plugins:
    [
    ],
    module:
    {
        rules:
        [
            {
                test:/\.ts$/,
                exclude:[/node_modules/, path.join(ELECTRON_PATH, '/js/')],
                loader:'ts-loader',
                options:
                {
                    transpileOnly:true,
                    instance:'main',
                    configFile:path.join(ELECTRON_PATH, 'tsconfig.json'),
                },
            }
        ]
    }
},
{
    devtool:'eval-source-map',
    entry:
    {
        bridge:path.join(ELECTRON_BRIDGE_SOURCE_PATH, "Bridge.ts"),
    },
    output:
    {
        publicPath:'',
        compareBeforeEmit:true,
        path:ELECTRON_PATH,
        filename:"js/[name].bundle.js",
        sourceMapFilename:'js/[name].bundle.js.map',
    },
    target:['electron-preload'],
    experiments: //https://webpack.js.org/configuration/experiments/
    {
        topLevelAwait:true //dynamic import at the top of a class
    },
    resolve:
    {
        extensions:['.ts', '.js'],
    },
    externals:{},
    plugins:
    [
    ],
    module:
    {
        rules:
        [
            {
                test:/\.ts$/,
                exclude:[/node_modules/, path.join(ELECTRON_PATH, '/js/')],
                loader:'ts-loader',
                options:
                {
                    transpileOnly:true,
                    instance:'bridge',
                    configFile:path.join(ELECTRON_PATH, 'tsconfig.json'),
                },
            }
        ]
    }
}];
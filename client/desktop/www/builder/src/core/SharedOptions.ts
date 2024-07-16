/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Main } from "../Main";
import { DevEnvironment } from "./DevEnvironment";
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';

export default (doPreBuild:Function, doPostBuild:Function) =>
{
    let options:webpack.Configuration =
    {
        amd:false,
        output:
        {
            compareBeforeEmit:true,
            path:Main.WWW_PATH,
            publicPath:'',
            filename:"js/[name].bundle.js",
            sourceMapFilename:'map/[name].bundle.js.map', //why map dir? because there are issues with using js/ that's why
        },
        target:['web', 'es2023'],
        experiments: //https://webpack.js.org/configuration/experiments/
        {
            topLevelAwait:true, //dynamic import at the top of a class
            asyncWebAssembly:false,
            syncWebAssembly:false,
        },
        resolve:
        {
            extensions:['.ts'],
        },
        externals:
        {
            'bootstrap':'bootstrap',
            'hash-wasm':'hashwasm',
            'mp4box':'MP4Box',
            'FFmpegWASM':'FFmpegWASM'
        },
        performance: 
        {
            hints:false,
            maxEntrypointSize:512000,
            maxAssetSize:512000
        },
        plugins:
        [
            new webpack.IgnorePlugin({checkResource:(resource:string) => 
            {
                if (Main.environment !== DevEnvironment.Dev && resource.indexOf('.test') !== -1) return true; //iignore test files if production
                    
                return false;
            }}),
            {
                apply:(compiler:any) => 
                {
                    compiler.hooks.beforeCompile.tap('BeforeBuildPlugin', async (compilation:any) => 
                    {
                        return doPreBuild();
                    });
                }
            },
            {
                apply:(compiler:any) => 
                {
                    compiler.hooks.done.tap('AfterBuildPlugin', async (compilation:any) => 
                    {
                        return doPostBuild();
                    });
                }
            }
        ]
    };

    if (Main.environment === DevEnvironment.Dev) 
    {
        options.mode = 'development';
        options.devtool = 'eval-source-map';
    }
    else
    {
        options.mode = 'production';
        //options[0].devtool = 'source-map', //don't output source maps will we can prevent them from being seen by users
        
        options.optimization = 
        {
            minimize:true,
            mangleExports:'deterministic',
            mergeDuplicateChunks:true,
            flagIncludedChunks:true,
            concatenateModules:true,
            chunkIds:'deterministic',
            moduleIds:'deterministic',
            removeAvailableModules:false,
            removeEmptyChunks:true,
            innerGraph:false,
            minimizer:[new TerserPlugin({terserOptions: //https://github.com/terser/terser#mangle-properties-options
                {
                    ecma:2020,
                    mangle:
                    {
                        properties:
                        {
                            builtins:false,
                            keep_quoted:'strict',
                            debug:false,
                            regex: /^_[a-zA-Z_$][0-9a-zA-Z_$]*$/, //mangle any property that begins with an underscore
                            reserved:['_id'], //don't mangle any properties that are reserved
                        }, 
                        keep_classnames:false, 
                        keep_fnames:false, 
                        module:true, 
                        toplevel:true
                    }, 
                    sourceMap:true, 
                    compress:
                    {
                        ecma:2020, //if you're having browser compatibility issues, maybe lower this
                        passes:2, //slows compilation down. todo, check if there is a significant difference between 1 and 2
                        hoist_vars:false, //maybe turns this off as it increases the build size
                        hoist_funs:true, keep_infinity:true, module:true, toplevel:true, 
                        unsafe:true,  //if you have any prod only issues, look at the unsafe options first
                        unsafe_arrows:true //if you have any prod only issues, look at the unsafe options first
                    },

                    format: 
                    {
                        comments: /@license/i,
                    },
                },
                extractComments:false,
            })],
        }
    }

    return options;
}
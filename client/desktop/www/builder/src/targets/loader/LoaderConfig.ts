/**
 * @license		UNLICENSED
 * @date		04.01.2023
 * @copyright   Untitled.io
 * @author      John Brandle
 */

import { Main } from "../../Main";
import path from 'path';
import SharedOptions from "../../core/SharedOptions";
import { IConfig } from "../../core/IConfig";
import webpack from 'webpack';

const addManglePropsTransformer = require('ts-loader-addmanglepropcommentstransformer');
const forceSuperTransformer = require('ts-loader-forcesupertransformer');

export class LoaderConfig implements IConfig
{
    constructor()
    {
    }

    getPreBuild = async () =>
    {
    }

    getPostBuild = async () =>
    {   
    }

    getOptions():webpack.Configuration
    {
        let options =
        {
            entry:
            {
                loader:path.join(this.sourcePath, "./Loader.ts"),
            },
            module:
            {
                rules:
                [
                    {
                        test:/\.ts$/,
                        loader:'ts-loader',
                        options:
                        {
                            transpileOnly:true,
                            getCustomTransformers:(program:any) => ({
                                before: [
                                    //addManglePropsTransformer(program),
                                    forceSuperTransformer(program) 
                                ]
                            }),
                            instance:'loader',
                            configFile:path.join(this.sourcePath, 'tsconfig.json'),
                        },
                    },
                    { 
                        test:/\.json$/, 
                        include:[this.sourcePath],
                        type:'json' 
                    },
                ]
            }
        };
        
        let shared = SharedOptions(() => {}, () => {});

        return {...options, ...shared};
    }

    get sourcePath()
    {
        return Main.LOADER_SOURCE_PATH;
    }

    get watchFiles()
    {
        return [Main.LOADER_SOURCE_PATH, Main.SHARED_PATH];
    }

    get watchIgnored():Array<string|RegExp>
    {
        return [];
    }
}
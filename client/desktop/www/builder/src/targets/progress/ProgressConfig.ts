/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Main } from "../../Main";
import path from 'path';
import SharedOptions from "../../core/SharedOptions";
import { IConfig } from "../../core/IConfig";
import webpack from 'webpack';

const addManglePropsTransformer = require('ts-loader-addmanglepropcommentstransformer');
const forceSuperTransformer = require('ts-loader-forcesupertransformer');

export class ProgressConfig implements IConfig
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
                progress:path.join(this.sourcePath, "./Progress.ts"),
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
                            instance:'progress',
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
        return Main.PROGRESS_SOURCE_PATH;
    }

    get watchFiles()
    {
        return [Main.PROGRESS_SOURCE_PATH, Main.SHARED_PATH];
    }

    get watchIgnored():Array<string|RegExp>
    {
        return [];
    }
}
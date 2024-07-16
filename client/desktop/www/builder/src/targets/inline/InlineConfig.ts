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

export class InlineConfig implements IConfig
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
                inline:path.join(this.sourcePath, "./Inline.ts"),
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
                            instance:'inline',
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
        return Main.INLINE_SOURCE_PATH;
    }

    get watchFiles()
    {
        return [Main.INLINE_SOURCE_PATH, Main.SHARED_PATH];
    }

    get watchIgnored():Array<string|RegExp>
    {
        return [];
    }
}
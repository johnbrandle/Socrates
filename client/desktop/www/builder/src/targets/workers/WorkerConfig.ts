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

export class WorkerConfig implements IConfig
{
    private _name:string;
    private _sourcePath:string;
    private _mainFile:string;

    constructor(name:string, sourcePath:string, mainFile:string)
    {
        this._name = name;
        this._sourcePath = sourcePath;
        this._mainFile = mainFile;
        console.log(name, sourcePath, mainFile)
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
                [`worker_${this._name}`]:path.join(this._sourcePath, this._mainFile),
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
                            instance:`worker_${this._name}`,
                            configFile:path.join(this._sourcePath, 'tsconfig.json'),
                        },
                    },
                    { 
                        test:/\.json$/, 
                        include:[this._sourcePath],
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
        return this._sourcePath;
    }

    get watchFiles()
    {
        return [this._sourcePath, Main.SHARED_PATH];
    }

    get watchIgnored():Array<string|RegExp>
    {
        return [];
    }
}
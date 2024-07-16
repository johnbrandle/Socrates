/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";

@SealedDecorator()
export class ConfigUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public get(global:true):ConfigGlobal;
    public get(global:false):ConfigLocal | ConfigRemote;
    public get(global:boolean):ConfigGlobal | ConfigLocal | ConfigRemote 
    {   
        const frozen = environment.frozen;

        return global === true ? frozen.config.global : (frozen.isLocalhost === true ? frozen.config.local : frozen.config.remote);
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import {contextBridge} from 'electron';
import { BridgeAPI } from './BridgeAPI';
import config from '../../../../../shared/config.json';
import { DevEnvironment } from '../../../../../shared/src/library/IEnvironment';

const environment = globalThis.environment =
{
    frozen:
    {
        isPlainTextMode:false,
        isLocalhost:false,
        config:config,
        devEnvironment:DevEnvironment.Prod as DevEnvironment,
        isDebug:false as boolean,
    },
    isDevToolsOpen:false as boolean
};

export class Bridge
{
    constructor()
    {
        const bridgeAPI = this.#createAPIFrom(new BridgeAPI(this));
        contextBridge.exposeInMainWorld('bridgeAPI', bridgeAPI);
    }

    #createAPIFrom(object:Record<string, any>)
    {
        const api:Record<string, any> = {};
        const propertyNames = Object.keys(object);
    
        for (const propertyName of propertyNames)
        {
            if (propertyName === 'constructor') continue;
    
            switch (typeof object[propertyName])
            {
                case 'function':
                    api[propertyName] = object[propertyName].bind(object);
                    break;
                case 'object':
                    api[propertyName] = this.#createAPIFrom(object[propertyName]);
                    break; 
                default:
            }
        }

        return api;
    };

    public get environment() { return environment; }
}

new Bridge();
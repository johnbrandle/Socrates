/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import {ipcRenderer, type IpcRendererEvent} from 'electron';
import type { Bridge } from './Bridge';
import { ConsoleUtil } from '../../../../../shared/src/library/utils/ConsoleUtil';
import { type uid } from '../../../../../shared/src/library/utils/UIDUtil';
import { HashUtil } from '../../../../../shared/src/library/utils/HashUtil';
import { DevEnvironment } from '../../../../../shared/src/library/IEnvironment';
import type { IBaseApp } from '../IBaseApp';
import type { IError } from '../../../../../shared/src/library/error/IError';

//faking the app object
const _app = new (class 
{
    #_hashUtil:HashUtil<any> | undefined;
    get hashUtil():HashUtil<any> { return this.#_hashUtil ??= new HashUtil(this as unknown as IBaseApp<any>); }

    #_consoleUtil:ConsoleUtil<any> | undefined;
    get consoleUtil():ConsoleUtil<any> { return this.#_consoleUtil ??= new ConsoleUtil(this as unknown as IBaseApp<any>, 'ELECTRON BRIDGE'); }

    //temporary until we have a real app object
    throw = (message:string, data:any[], options?:{names?:Function[]}):never => { throw new Error(message); }
    warn = (error:unknown, message:string, data:any[], options?:{errorOnly?:boolean, names?:Function[]}):IError => { return console.error(error) as unknown as IError; }
})();
type A = typeof _app;

export class BridgeAPI
{
    #_initialized = false;

    #_bridge:Bridge;

    #_key!:uid;

    #_subscriptions:Map<Function, (event:IpcRendererEvent, ...data:any[]) => any> = new Map();

    constructor(bridge:Bridge)
    {
        this.#_bridge = bridge;
    }

    init = async (isLocalhost:boolean):Promise<uid | false> => //first thing app calls
    {
        try
        {
            if (this.#_initialized) _app.throw('already initialized', []);
            this.#_initialized = true;

            const key = this.#_key = self.crypto.randomUUID() as uid;

            ipcRenderer.addListener('log', (_event:IpcRendererEvent, ...data:any[]) => _app.consoleUtil.__log('ELECTRON MAIN', '#388cc7', console.log, this.constructor, ...data)); //log messages from Main
            ipcRenderer.addListener('warn', (_event:IpcRendererEvent, ...data:any[]) => _app.consoleUtil.__log('ELECTRON MAIN', '#e4d21b', console.warn, this.constructor, ...data));
            ipcRenderer.addListener('error', (_event:IpcRendererEvent, ...data:any[]) => _app.consoleUtil.__log('ELECTRON MAIN', '#e5341a', console.error, this.constructor, ...data));

            const {isDebug, devEnvironment} = await ipcRenderer.invoke('init', isLocalhost, key) as {isDebug:boolean, devEnvironment:DevEnvironment};

            this.#_bridge.environment.frozen.isDebug = isDebug;
            this.#_bridge.environment.frozen.devEnvironment = devEnvironment;
            Object.freeze(this.#_bridge.environment.frozen);

            _app.consoleUtil.log(this.constructor, 'initialized');

            return key;
        }
        catch (error)
        {
            _app.warn(error, 'init errored', [], {names:[BridgeAPI, this.init]});

            return false;
        }
    }

    subscribe = async (key:uid, callback:Function):Promise<boolean> =>
    {
        try
        {
            if (this.#verifyKey(key) === false) _app.throw('key is not valid', []);

            const listener = (_event:IpcRendererEvent, ...data:any[]) => callback.apply(this, data);
            this.#_subscriptions.set(callback, listener);

            ipcRenderer.addListener('renderer', listener);

            return true;
        }
        catch (error)
        {
            _app.warn(error, 'subscribe errored', [], {names:[BridgeAPI, this.subscribe]});

            return false;
        }
    }

    unsubscribe = async (securityKey:uid, callback:Function):Promise<boolean> =>
    {
        try
        {
            if (this.#verifyKey(securityKey) === false) _app.throw('key is not valid', []);

            const listener = this.#_subscriptions.get(callback);
            if (listener === undefined) _app.throw('listener not found', []);

            ipcRenderer.removeListener('renderer', listener!);

            return true;
        }
        catch (error)
        {
            _app.warn(error, 'unsubscribe errored', [], {names:[BridgeAPI, this.unsubscribe]});

            return false;
        }
    }

    //used for ipc communication from renderer to main
    invoke = async (key:uid, path:any, data:Uint8Array):Promise<Uint8Array | undefined> =>
    {
        try
        {
            if (this.#verifyKey(key) === false) _app.throw('key is not valid', []);

            const result = await ipcRenderer.invoke('api', key, path, data);

            if (result === undefined) _app.throw('result is undefined', []);

            return result;
        }
        catch (error)
        {
            _app.warn(error, 'invoke errored', [], {names:[BridgeAPI, this.invoke]});

            return undefined;
        }
    }

    #verifyKey = (key:uid):boolean =>
    {
        if (this.#_bridge.environment.frozen.devEnvironment !== DevEnvironment.Prod) return true;

        return this.#_key !== undefined && _app.hashUtil.verify(key, this.#_key) === true;
    }
}
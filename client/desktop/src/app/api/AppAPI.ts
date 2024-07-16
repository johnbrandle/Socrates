/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @description Electron app code
 */

import { type uid } from '../../../../../shared/src/library/utils/UIDUtil.ts';
import { HTTPAPI } from './HTTPAPI.ts';
import { WebViewAPI } from './WebViewAPI.ts';
import type { IError } from '../../../../../shared/src/library/error/IError.ts';
import { RemoteAbortController } from './classes/RemoteAbortController.ts';
import { RemoteFileSystem } from './classes/RemoteFileSystem.ts';
import type { IApp } from '../IApp.ts';

/**
 * The main API class that is exposed to the web renderer process.
 * 
 * See `BrigeManager.ts` for how this class is used.
 */
export class AppAPI
{
    //important! do not expose this to the renderer process
    #_app:IApp;
    
    public http:HTTPAPI;
    public webView:WebViewAPI;

    public classes = {RemoteFileSystem, RemoteAbortController};

    constructor(app:IApp)
    {
        this.#_app = app;

        this.http = new HTTPAPI(app);
        this.webView = new WebViewAPI(app);
    }

    public inspect = async (x:number, y:number):Promise<void> => 
    {
        return (this.#_app.browserWindow as any).inspectElement(x, y);
    };

    /**
     * Certain instances can be created, called upon, and released by the web renderer process.
     * 
     * This is useful for creating instances of classes that are not available in the renderer process,
     * but using them as if they were.
     * 
     * A uid is returned which can be used to call methods on the instance and/or release the instance.
     * 
     * @param path - an array of strings that represent the path to the class, example: ['classes', 'Foo'] 
     * @param args - an array of arguments to pass to the constructor of the class
     * @returns the uid of the instance, or an error
     */
    public createInstance = async (path:string[], args:any[]):Promise<uid | IError> =>
    {
        return this.#_app.instanceManager.create(path, args);
    }

    /**
     * Call a method on an instance that was created by createInstance.
     * 
     * @param uid - the uid of the instance
     * @param path - an array of strings that represent the path to the method, example: ['someMethod']
     * @param args - an array of arguments to pass to the method
     * @returns - the result of the method, or an error
     */
    public callOnInstance = async (uid:uid, path:string[], ...args:any[]):Promise<unknown | IError> =>
    {
        return this.#_app.instanceManager.callOn(uid, path, ...args);
    }

    /**
     * Release an instance that was created by createInstance. (makes it available for garbage collection)
     * 
     * @param uid - the uid of the instance
     * @returns - true, or an error
     */
    public releaseInstance = async (uid:uid):Promise<true | IError> =>
    {
        return this.#_app.instanceManager.remove(uid);
    }
}
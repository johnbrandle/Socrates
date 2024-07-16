/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../../../../../shared/src/library/decorators/ImplementsDecorator";
import { DestructableEntity } from "../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IError } from "../../../../../shared/src/library/error/IError";
import type { IDestructor } from "../../../../../shared/src/library/IDestructor";
import type { uid } from "../../../../../shared/src/library/utils/UIDUtil";
import { DevEnvironment } from "../../../www/builder/src/core/DevEnvironment";
import { SerializationHelper } from "../../library/helpers/SerializationHelper";
import { AppAPI } from "../api/AppAPI";
import type { IApp } from "../IApp";
import {ipcMain} from 'electron';
import { IAPIManagerType, type IAPIManager } from "./IAPIManager";

@ImplementsDecorator(IAPIManagerType)
export class APIManager<A extends IApp<A>> extends DestructableEntity<A> implements IAPIManager<A>
{
    #_appAPI!:AppAPI;
    #_key:uid | undefined;

    //important! do not expose this to the renderer process
    #_initialized = false;

    #_serializationHelper:SerializationHelper<IApp> = new SerializationHelper(this.app);

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        //called by Bridge
        ipcMain.handle('init', async (event, isLocalhost:boolean, key:uid) => 
        {
            if (this.#verifySenderID(event.sender.id) === false) app.throw('sender id is not valid', [], {correctable:true});

            const result = {isDebug:app.environment.frozen.isDebug, devEnvironment:app.environment.frozen.devEnvironment};

            if (this.#_initialized === true) return result; //in debug mode main is reused when the page refreshes due to a code change in the content
            this.#_initialized = true;

            if (this.#_key !== undefined) app.throw('key already set', []);
            this.#_key = key;

            return result;
        });

        //for IPC API communication, no stream support
        ipcMain.handle('api', async (event, key:uid, path:string[], uint8Array:Uint8Array):Promise<Uint8Array | undefined> => 
        {
            try
            {
                if (this.#verifySenderID(event.sender.id) === false) app.throw('sender id is not valid', [], {correctable:true});

                const stream = app.extractOrRethrow(await this.handleRequest(key, path, app.streamUtil.fromUint8Array(uint8Array)));
                
                return app.extractOrRethrow(await app.streamUtil.toUint8Array(stream.body!));
            }
            catch (error)
            {
                app.warn(error, 'api errored calling: {}', [path], {names:[APIManager, this.handleRequest]});

                return undefined;
            }
        });

        //create the app api
        this.#_appAPI = new AppAPI(app);
    }

    /**
     * This is called by the IPC handler and the HTTP handler (@see `Server.ts`) to handle API requests.
     * 
     * @param main - the main instance
     * @param path - the path to the API function, example: ['dataStorage', 'readFile']
     * @param data - the data to pass to the API function
     * @returns - the response to send back to the client
     */
    public async handleRequest(key:uid, path:string[], data:ReadableStream<Uint8Array> | undefined):Promise<Response | IError>
    {
        const app = this._app;

        try
        {
            if (this.#verifyKey(key) === false) this._app.throw('key is not valid', [], {correctable:true});
    
            const originalPath = path;
            path = path.slice();
    
            const asyncGenerator = data ? this.#_serializationHelper.fromStream(data) : undefined;
    
            const args = [];
    
            //gather the arguments
            if (asyncGenerator !== undefined) for await (const part of asyncGenerator) args.push(app.extractOrRethrow(part).value);
            
            let scope:any = this.#_appAPI;
            const functionName = path.pop()!;
            for (const part of path)
            {
                if (app.accessUtil.isValidPropAccess(scope, part) !== true) app.throw('api path not found: {}', [originalPath.join('->')]);
                
                scope = scope[part];
            }
    
            if (app.accessUtil.isValidPropAccess(scope, functionName) !== true) app.throw('api path not found: {}', [originalPath.join('->')]);
    
            //call the api function
            let result = await ((scope[functionName] as Function).apply(scope, args));
    
            if (app.typeUtil.isError(result) === true) result = app.warn(result, 'api errored calling: {}', [originalPath.join('->'), path, data], {names:[APIManager, this.handleRequest]});
    
            const stream = app.extractOrRethrow(await this.#_serializationHelper.toStream([result]));
    
            return this._app.responseUtil.stream(stream, {}, 'application/octet-stream');
        }
        catch (error)
        {
            return app.warn(error, 'api errored calling: {}', [path, data], {errorOnly:true, names:[APIManager, this.handleRequest]});
        }
    }
      
    public get api():AppAPI
    {
        return this.#_appAPI;
    }

    #verifySenderID(senderID:number):boolean
    {
        return environment.frozen.devEnvironment !== DevEnvironment.Prod || senderID === this.app.browserWindow.webContents.id;
    }

    #verifyKey(key:uid):boolean
    {
        if (environment.frozen.devEnvironment !== DevEnvironment.Prod) return true;

        return this.#_key !== undefined && this._app.hashUtil.verify(key, this.#_key) === true;
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import { ErrorCode } from '../../../../../../../shared/src/app/json/ErrorJSON.ts';
import { ErrorJSONObject } from '../../../../../../../shared/src/app/json/ErrorJSONObject.ts';
import { BaseOutputFormat } from '../../../library/utils/BaseUtil.ts';
import { DestructableEntity } from '../../../../../../../shared/src/library/entity/DestructableEntity.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import type { base64 } from '../../../../../../../shared/src/library/utils/BaseUtil.ts';
import type { emptystring } from '../../../../../../../shared/src/library/utils/StringUtil.ts';
import { type json } from '../../../../../../../shared/src/library/utils/JSONUtil.ts';
import { DevEnvironment } from '../../../../../../../shared/src/library/IEnvironment.ts';

const CACHE_NAME = 'webclientcache';
const RETRY_DELAY = 500;

export class WebClient<A extends IApp<A>> extends DestructableEntity<A>
{
    private _cache:Cache | undefined;
   
    constructor(app:A, destructor:IDestructor<A>, options?:{enableCache?:boolean}) 
    {
        super(app, destructor);

        const cachingEnabled = options?.enableCache ?? (this._app.environment.frozen.isLocalhost !== true && this._app.environment.frozen.devEnvironment === DevEnvironment.Prod);
        if (cachingEnabled === true) caches.open(CACHE_NAME).then((cache) => this._cache = cache);
    }

    async #request(uri:string, options:RequestInit, cache:boolean=false, tries:number=3):Promise<[string, ReadableStream<Uint8Array> | undefined] | ErrorJSONObject> 
    {
        const abort = async (code:string, reason:string) => 
        {
            if (this._app.environment.frozen.isLocalhost) console.error(reason);
            
            if (tries <= 0) 
            {
                this._app.networkManager.notifyConnectionErrorOccured(); //let the network manager know something is wrong with the connection    
                return new ErrorJSONObject({error:ErrorCode.GLOBAL_CONNECTION_ERROR, details:'code: ' + code + ', reason: ' + reason});
            }

            await this._app.promiseUtil.wait(RETRY_DELAY);
            return await this.#request(uri, options, cache, --tries);
        }

        let response:Response | undefined;

        if (cache && this._cache !== undefined)
        {
            response = await this._cache.match(uri);

            if (response && response.headers.has('X-Json'))
            {
                const text = (response.headers.get('X-Json') ?? '') as base64 | emptystring;
                const json = text !== '' ? this._app.baseUtil.fromBase64(text, BaseOutputFormat.string) : '';

                return [json, response.body ?? undefined];
            }

            if (response) return [await response.text(), undefined]; 
        }

        try
        {
            const url = new URL(uri, window.location.origin);
            url.searchParams.append('etag', this._app.configUtil.get(true).etag);
            
            //set the timestamp in the header to protect against replay attacks
            options.headers = options.headers ?? {};
            (options.headers as any)['timestamp'] = Date.now().toString();
            
            response = await fetch(url, options);
            
            this._app.networkManager.notifyConnectionSucceded(); //let the network manager know we had a successful connection. even if we get a bad response?

            if (!response.ok) return await abort(response.status.toString(), response.statusText);
            
            if (cache && this._cache !== undefined) await this._cache.put(uri, response.clone());
            
            if (response.headers.has('X-Json'))
            {       
                const text = (response.headers.get('X-Json') ?? '') as base64 | emptystring;
                const json = text !== '' ? this._app.baseUtil.fromBase64(text, BaseOutputFormat.string) : '';

                return [json, response.body ?? undefined];
            }

            return [await response.text(), undefined];
        }
        catch(error:unknown)
        {
            tries = 0; //assume this was caused by a low level connection issue, so do not retry (the user is probably not connected to the internet)
            return await abort('Unknown', String(error));
        }
    }

    protected async _jsonRequest<K extends object>(uri:string, options:RequestInit, cache:boolean=false, tries:number=3):Promise<{json:K, body?:ReadableStream<Uint8Array>} | ErrorJSONObject> 
    {
        if (this._app.environment.frozen.isOfflineSimulationMode === true) return new ErrorJSONObject({error:ErrorCode.GLOBAL_CONNECTION_ERROR, details:'simulated offline mode'});
        
        let data:[string, ReadableStream<Uint8Array> | undefined] | ErrorJSONObject | undefined;
        try
        {
            data = await this.#request(uri, options, cache, tries);
            
            if (data instanceof ErrorJSONObject) return data;

            const parsed = this._app.extractOrRethrow(this._app.jsonUtil.parse(data[0] as json) as K);

            const errorObj = ErrorJSONObject.extract(parsed);
            if (errorObj instanceof ErrorJSONObject) return errorObj;

            return {json:parsed, body:data[1] ?? undefined};
        }
        catch(error:unknown)
        {
            this._app.warn(error, 'Trouble parsing', arguments, {names:[WebClient, this._jsonRequest]});
            
            return new ErrorJSONObject({error:ErrorCode.GLOBAL_JSON_PARSE, details:String(error)});
        }
    }

    public async getJSON<T extends JsonObject, K extends JsonObject | JsonArray>(uri:string, json:T, body?:JsonObject | Blob | ReadableStream<Uint8Array>, cache:boolean=false, tries:number=3, log:boolean=true):Promise<{json:K, body?:ReadableStream<Uint8Array>} | ErrorJSONObject>
    {
        const options = this._app.requestUtil.deriveInit(json, body);
     
        const response = await this._jsonRequest<K>(uri, options, cache, tries);
        
        if (response instanceof ErrorJSONObject) return response;

        if (log === true) this.log('getJSON:', decodeURIComponent(uri), response.json);

        return response;
    }

    public override async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        if (this._cache !== undefined) await caches.delete(CACHE_NAME);

        return true;
    }
}
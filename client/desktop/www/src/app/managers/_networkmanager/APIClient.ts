/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import { ErrorJSONObject } from '../../../../../../../shared/src/app/json/ErrorJSONObject.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { WebClient } from './WebClient.ts';
import { UserAPI } from './UserAPI.ts';
import { WalletAPI } from './WalletAPI.ts';

export class APIClient<A extends IApp<A>> extends WebClient<A>
{    
    public user:UserAPI<A> = new UserAPI(this._app);
    public wallet:WalletAPI<A> = new WalletAPI(this._app);

    constructor(app:A, destructor:IDestructor<A>) 
    {
        super(app, destructor, {enableCache:false});
    }

    public async call<T extends JsonObject, K extends JsonObject>(name:string, uri:string, json:T, body?:string):Promise<{json:K, body?:ReadableStream<Uint8Array>} | ErrorJSONObject>
    {
        await this._app.promiseUtil.wait(this._app.configUtil.get(true).api.delay); //wait or we will get rate limiting errors
        
        const response = await this._jsonRequest<K>(this._app.apiUtil.url(name, uri), this._app.requestUtil.deriveInit(json, body), false, 0);
        
        if (response instanceof ErrorJSONObject) return response;

        this.log('call:', decodeURIComponent(uri), response.json);

        return response; 
    }

    public async upload<T extends JsonObject, K extends JsonObject>(name:string, uri:string, json:T, body:Blob):Promise<{json:K} | ErrorJSONObject>
    {
        await this._app.promiseUtil.wait(this._app.configUtil.get(true).api.delay); //wait or we will get rate limiting errors

        const response = await this._jsonRequest<K>(this._app.apiUtil.url(name, uri), this._app.requestUtil.deriveInit(json, body), false, 3);

        if (response instanceof ErrorJSONObject) return response;

        this.log('upload:', decodeURIComponent(uri), response.json);
    
        return response;
    }
}
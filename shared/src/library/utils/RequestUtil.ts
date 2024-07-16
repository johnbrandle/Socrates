/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";

@SealedDecorator()
export class RequestUtil<A extends IBaseApp<A>>
{   
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public async extract<T>(request:Request | Response, validate?:(app:A, value:T)=>Response | T):Promise<T | Response>
    {
        return this._app.responseUtil.extract<T>(request, validate);
    }

    public deriveInit(json:JsonObject, blob?:ReadableStream<Uint8Array> | Blob | JsonObject | string):RequestInit
    {
        const app = this._app;

        if (blob !== undefined)
        {
            if (blob instanceof Blob || blob instanceof ReadableStream)
            {
                const headers = {'X-Json':app.baseUtil.toBase64(app.jsonUtil.stringify(json)), 'Content-Type':'application/octet-stream'};
                
                //@ts-ignore
                return {method:'POST', headers:headers, body:blob, duplex:'half'};
            }
            else 
            {
                const headers = {'X-Json':app.baseUtil.toBase64(app.jsonUtil.stringify(json)), 'Content-Type':'application/json'};
                
                return {method:'POST', headers:headers, body:app.typeUtil.isString(blob) ? blob : app.jsonUtil.stringify(blob)};
            }
    
        }

        const headers = {'X-Json':app.baseUtil.toBase64(app.jsonUtil.stringify(json)), 'Content-Type':'application/json'};
        return {method:'GET', headers:headers};
    }
}
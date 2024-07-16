/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { json } from '../../library/utils/JSONUtil.ts';
import { SealedDecorator } from '../../library/decorators/SealedDecorator.ts';
import { IBaseApp } from '../../library/IBaseApp.ts';

@SealedDecorator()
export class APIUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public url(name:string, path:string):string
    {
        const config = this._app.configUtil.get(false)

        let useProxy = true;//false; //TODO, determine when to use the proxy, if ever

        if (config.proxy && useProxy)
        {
            path = `/proxy?${name}=` + encodeURIComponent(path);
            name = 'proxy';
        }

        const prepend = (config.workers as Record<string, string>)[name];

        return prepend + path;
    }

    public get names() { return this._app.configUtil.get(true).api.names; }
    public get endpoints() { return this._app.configUtil.get(true).api.endpoints; }

    public getOptions(json:json, blob?:Blob | string)
    {
        const app = this._app;

        if (blob && blob instanceof Blob)
        {
            const headers = {'X-Json':app.baseUtil.toBase64(app.jsonUtil.stringify(json)), 'Content-Type':'application/octet-stream'};
            
            return {method:'POST', headers:headers, body:blob};
        }
        else if (blob)
        {
            const headers = {'X-Json':app.baseUtil.toBase64(app.jsonUtil.stringify(json)), 'Content-Type':'application/json'};
            
            return {method:'POST', headers:headers, body:blob};
        }

        const headers = {'X-Json':app.baseUtil.toBase64(app.jsonUtil.stringify(json)), 'Content-Type':'application/json'};
        return {method:'GET', headers:headers};
    }
}
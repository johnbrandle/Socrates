/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../app/IApp";

interface DurableObjectStub
{
    fetch:Function;
}

export class DurableObjectUtil<A extends IApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public async do<B, T>(record:DurableObjectStub, command:string, json:B):Promise<Response | T>
    {
        const options:Record<string, any> = {method:'POST'};
        options.headers = {'Content-Type':'application/json'};
        options.body = JSON.stringify(json);
        
        const response = await record.fetch('http://1.1.1.1' + command, options);
        return this._app.responseUtil.extract<T>(response);
    }    
}
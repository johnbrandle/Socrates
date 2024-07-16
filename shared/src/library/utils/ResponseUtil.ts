/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ErrorCode, ErrorJSON } from "../../app/json/ErrorJSON";
import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";
import { BaseOutputFormat, base64 } from "./BaseUtil";
import { emptystring } from "./StringUtil";

@SealedDecorator()
export class ResponseUtil<A extends IBaseApp<A>>
{
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public async extract<T>(request:Request | Response, validate?:(app:A, value:T)=>Response | T):Promise<T | Response>
    {
        let text = '';
     
        try
        {
            let value:Record<string, any>;
            if (request.headers.has('X-Json'))
            {
                const base64 = (request.headers.get('X-Json') ?? '') as base64 | emptystring;
                text = base64 !== '' ? this._app.extractOrRethrow(this._app.baseUtil.fromBase64(base64, BaseOutputFormat.string)) : ''; 
            }
            else if (request instanceof Request)
            {
                if (request.method !== 'POST') this._app.throw('no json present', []);

                const bytes = parseInt(request.headers.get('content-length')!);
                if (bytes > 1024 * 64) throw this._app.throw('body too large', []);

                const body = request.body;
                if (!body) this._app.throw('body not present', []);

                const stream = this._app.streamUtil.transform(body, [this._app.streamUtil.createLimitTransformer(bytes)]); //ensure body is not too large, as content-length may not be accurate
                
                text = await new Response(stream).text();
            }
            else text = await request.text();

            value = JSON.parse(text);
            
            if (value.error !== undefined && value.details !== undefined) return this.error(value as ErrorJSON);

            return validate ? validate(this._app, value as T) : value as T;
        }
        catch (error) 
        {
            return this.error({error:ErrorCode.GLOBAL_JSON_PARSE, details:`trouble parsing request json. perhaps it is missing or too large: ${text}`}, error);
        }
    }

    public stream(stream:ReadableStream<Uint8Array>, json:Record<string, any>, contentType:string):Response
    {
        const response = new Response(stream);
        response.headers.set('X-Json', this._app.baseUtil.toBase64(JSON.stringify(json)));
        response.headers.set('Content-Type', contentType);

        return response;
    }

    public success():Response
    {
        return Response.json({success:true});
    }

    public error(errorJSON:ErrorJSON, error?:unknown):Response
    {
        if (error) console.error(error);

        return Response.json(errorJSON); 
    }   
}
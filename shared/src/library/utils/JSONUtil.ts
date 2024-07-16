/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * During stringification, undefined values are converted to null.
 * During parsing, null values are converted to undefined.
 * 
 * This way, undefined values are preserved during stringification and parsing.
 * And null values are represented as undefined.
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IError } from "../error/IError";
import { IBaseApp } from "../IBaseApp";

export type json = string & { _brand:'json'};

@SealedDecorator()
export class JSONUtil<A extends IBaseApp<A>> 
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public parse<T>(string:json):T | IError
    {
        try
        {
            //convert null values to undefined
            return JSON.parse(string, (_key, value) => value === null ? undefined : value);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to parse string', [string], {errorOnly:true, names:[JSONUtil, this.parse]});
        }
    }

    public stringify<T>(object:T):json
    {
        try
        {
            //convert undefined values to null
            return JSON.stringify(object, (_key, value) => value === undefined ? null : value) as json;
        }
        catch (error)
        {
            this._app.rethrow(error, 'Failed to stringify object', [object], {correctable:true});
        }
    }
    
    public clone<T>(object:T):T
    {
        try
        {
            //convert undefined values to null
            const stringified = JSON.stringify(object, (_key, value) => value === undefined ? null : value);

            //convert null values to undefined
            return JSON.parse(stringified, (_key, value) => value === null ? undefined : value);
        }
        catch (error)
        {
            this._app.rethrow(error, 'Failed to clone object', [object], {correctable:true});
        }
    }
}
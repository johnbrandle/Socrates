/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../../library/decorators/ImplementsDecorator.ts";
import { __isObject } from "../../library/utils/__internal/__is.ts";
import { ErrorJSONType, type ErrorJSON, ErrorCode } from "./ErrorJSON.ts";
import { ResultJSONType } from "./ResultJSON.ts";

@ImplementsDecorator(ErrorJSONType, ResultJSONType)
export class ErrorJSONObject implements ErrorJSON
{
    public error:ErrorCode;
    public details:string;
    public json?:string;

    constructor(errorJSON:ErrorJSON);
    constructor(error:ErrorCode, details:string, json?:string);
    constructor(...args:Array<any>)
    {
        if (args.length === 1)
        {
            let errorJSON = args[0] as ErrorJSON;

            this.error = errorJSON.error;
            this.details = errorJSON.details;
            this.json = errorJSON.json;
        }
        else
        {
            this.error = args[0] as ErrorCode;
            this.details = args[1] as string;
            this.json = args[2] as string;
        }
    }

    public get errorJSON():ErrorJSON
    {
        return {error:this.error, details:this.details, json:this.json};
    }

    public static extract<T>(json: T | ErrorJSON):T extends ErrorJSON ? ErrorJSONObject : T | ErrorJSONObject 
    {
        const result = (__isObject(json) && (json as any).error !== undefined && (json as any).details !== undefined) ? new ErrorJSONObject(json as ErrorJSON) : json;

        //@ts-ignore
        return result;
    }   

    public toString():string
    {
        return 'Error: ' + this.error + ', ' + this.details;
    }
}
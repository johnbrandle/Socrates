/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IAbortable, IAbortableType } from "../abort/IAbortable";
import { IAborted } from "../abort/IAborted";
import { SealedDecorator } from "../decorators/SealedDecorator";
import { IError, IErrorType } from "../error/IError";
import { IFailure, IFailureType } from "../fail/IFailure";
import { IBaseApp } from "../IBaseApp";
import { __is, __isBoolean, __isObject, __isString } from "./__internal/__is";

export enum TypeOf
{
    null = 0, //todo, deprecate null support
    undefined = 1,
    
    string = 2,
    boolean = 3,
    number = 4,
    
    Array = 5,
    Object = 6,

    Function = 7,
    
    symbol = 8,
    bigint = 9
}

@SealedDecorator()
export class TypeUtil<A extends IBaseApp<A>> 
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public isNullOrUndefined(any:any):any is null | undefined { return any === null || any === undefined; }
    public isString = __isString; //will not catch boxed strings, but we shouldn't be using them anyway. typeof is fast, so we will not bother with doing slower instanceof call to check for boxed strings.
    public isNumber(any:any):any is number { return typeof any === 'number' && isNaN(any) === false; } //NaN will evaluate to false, which is what we want (we do not want to accept NaN as a valid number)
    public isBoolean = __isBoolean;
    public isBigInt(any:any):any is bigint { return typeof any === 'bigint'; }
    public isSymbol(any:any):any is symbol { return typeof any === 'symbol'; }
    public isArray(any:any):any is Array<any> { return Array.isArray(any); } //isArray is significantly faster than instanceof in chromium
    public isFunction(any:any):any is Function { return typeof any === 'function'; }
    public isObject = __isObject; //we are not counting null as being an object
    
    public isError(any:any):any is globalThis.Error; 
    public isError(any:any, IError:true):any is IError; 
    public isError(any:any, IError?:boolean):any is globalThis.Error | IError
    { 
        if (IError === true) return __is<IError>(any, IErrorType) === true;

        return any instanceof globalThis.Error 
    }
    
    public isAborted(any:any):any is IAborted { return __is<IAbortable>(any, IAbortableType) === true && any.aborted === true; }
    public isFailure(any:any):any is IFailure { return __is<IFailure>(any, IFailureType) === true; }

    /**
     * Check if a given object conforms to a specific type or interface.
     * @param object - The object to check.
     * @param Type - The type or interface (symbol) to check against.
     * @returns Whether the object conforms to the specified type or interface.
     */
    public is = __is;

    /**
     * Determines the type of the given value.
     * 
     * @warning Boxed String, Number, and Boolean objects will evaluate to type Object. This is desired tradeoff, as typeof is 
     * much faster than instanceof and valueOf, and more reliable than constructor comparison 
     * (which requires the objects have a shared window object to work).
     * 
     * @param {any} value - The value whose type you want to determine.
     * @returns {TypeOf} - The type of the value.
     */
    public getTypeOf(value:any):TypeOf
    {
        const type = typeof value;

        switch (type) 
        {
            case 'symbol':
                return TypeOf.symbol;
            case 'boolean':
                return TypeOf.boolean;
            case 'number':
                if (isNaN(value) === true) this._app.throw('TypeUtil.getTypeOf: NaN is not supported', []); //we do not want to support NaN as a valid number, and should never be accepted anywhere in the codebase
                return TypeOf.number;
            case 'bigint':
                return TypeOf.bigint;
            case 'string':
                return TypeOf.string;
            case 'function':
                return TypeOf.Function;
            case 'undefined':
                return TypeOf.undefined;
            case 'object':
                if (value === null) this._app.throw('TypeUtil.getTypeOf: null is not supported', []); //we do not want to support null as a valid object, and should never be accepted anywhere in the codebase
                if (Array.isArray(value) === true) return TypeOf.Array; //Array.isArray is actually quite fast.
                
                return TypeOf.Object;
        }

        this._app.throw('TypeUtil.getTypeOf: Unknown type: {}', [type], {correctable:true});
    }
}
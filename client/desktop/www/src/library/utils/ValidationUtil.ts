/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

type Options = 
{
    notEmpty?:true,
    length?:number,
    min?:number,
    max?:number,

    integer?:true,
}

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)

 * The difference between validation util and checks in other utils is that validation util will
 * throw an error if the value is invalid, whereas other utils will return a boolean.
 */
@SealedDecorator()
export class ValidationUtil<A extends IBaseApp<A>>
{   
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public is: 
    {
        <T extends string>(value: unknown, Type: StringConstructor, options?: Options): string | never;
        <T extends boolean>(value: unknown, Type: BooleanConstructor, options?: Options): boolean | never;
        <T extends number>(value: unknown, Type: NumberConstructor, options?: Options): number | never;
        <T>(value: unknown, Type: Symbol, options?: Options): T | never;
        <T>(value: unknown, Type: ObjectConstructor, options?: Options): T | never;
        <T>(value: unknown, Type: new () => T, options?: Options): T | never;
        <T>(value: unknown, Type: any, options?: Options): T | never;
    } = <T>(value: unknown, Type: any, options?: Options): T | never =>
    {
        const typeOfValue = typeof value;
        if (value === undefined || value === null || (typeOfValue === 'number' && isNaN(value as number) !== false)) this._app.throw('Value cannot be undefined, null, or NaN: expected "{Type}", but got "{value}"', [Type, value]);
    
        const isA = this._app.typeUtil.is(value, Type);
        if (isA !== true) this._app.throw('Expected value to be of type "{Type}", but got "{value}"', [Type, value]);

        //additional checks
        if (options?.notEmpty) this.isNotEmpty(value, typeOfValue);
    
        if (options?.length !== undefined) this.lengthEquals(value, typeOfValue, options.length);
    
        if (options?.min !== undefined || options?.max !== undefined) this.isWithinRange(value, typeOfValue, options.min ?? Number.MIN_SAFE_INTEGER, options.max ?? Number.MAX_SAFE_INTEGER);
    
        if (options?.integer !== undefined) this.isInteger(value);

        //if all checks pass
        return value as T;
    }
    
    public isNotEmpty = (value:unknown, typeOf:string):void | never =>
    {
        let length:number;
        switch (typeOf)
        {
            case 'string':
                length = (value as string).trim().length;
                break;
            case 'object':
                if (Array.isArray(value)) length = value.length;
                else length = Object.keys(value as object).length;
                break;
            default:
                this._app.throw('Cannot check if "{value}" is empty', [value]);
        }
    
        if (length > 0) return;
    
        this._app.throw('Value is empty "{value}"', [value]);
    }
    
    public lengthEquals = (value:unknown, typeOf:string, length:number):void | never =>
    {
        let actualLength:number;
        switch (typeOf)
        {
            case 'string':
                actualLength = (value as string).length;
                break;
            case 'object':
                if (Array.isArray(value)) actualLength = value.length;
                else actualLength = Object.keys(value as object).length;
                break;
            default:
                this._app.throw('Cannot check if "{value}" is of length "{length}"', [value, length]);
        }
    
        if (actualLength === length) return;
    
        this._app.throw('Expected value to be of length "{length}", but got "{actualLength}"', [length, actualLength]);
    }
    
    public isWithinRange = (value:unknown, typeOf:string, min:number, max=Number.MAX_SAFE_INTEGER):void | never =>
    {
        let success:boolean;
        switch (typeOf)
        {
            case 'number':
            {
                success = this._app.numberUtil.isWithinRange(value as number, min, max);
                break;
            }
            case 'string':
            {
                success = (value as string).length >= min && (value as string).length <= max;
                break;
            }
            case 'object':
            {
                if (Array.isArray(value)) success = value.length >= min && value.length <= max;
                else success = Object.keys(value as object).length >= min && Object.keys(value as object).length <= max;
                break;
            }
            default:
                this._app.throw('Cannot check if "{value}" is between "{min}" and "{max}"', [value, min, max]);
        }
    
        if (success === true) return;
    
        this._app.throw('Expected value to be between "{min}" and "{max}", but got "{value}"', [min, max, value]);
    }

    public isInteger = (value:unknown):void | never =>
    {
        if (this._app.integerUtil.is(value) === true) return;

        this._app.throw('Expected value to be an integer, but got "{value}"', [value]);
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ErrorCode } from "../../../../../../shared/src/app/json/ErrorJSON.ts";
import { CharSet } from "../../../../../../shared/src/library/utils/BaseUtil.ts";
import { HashSize, hex_128, hex_160, hex_256, hex_384, hex_512 } from "../../../../../../shared/src/library/utils/HashUtil.ts";
import { IApp } from "../../app/IApp.ts";

const hexRegex = /^[0-9a-fA-F]+$/;
const base24Regex = new RegExp(`^[${CharSet.Base24}]+$`);
const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4})$/;

export class ValidatorUtil<A extends IApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public notNull(obj:Record<string, any>):Response | undefined
    {
        if (!obj) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_INVALID_INPUT_DATA, details:'invalid data given'});
    }

    public hasPropertyCount(obj:Record<string, any>, expected:number):Response | undefined
    {
        const maxAllowed = 1000;
        let count = 0;
        for (const _key in obj) 
        {
            if (count >= maxAllowed) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_INVALID_INPUT_DATA, details:'invalid property count, expected: ' + expected});
            
            count++;
        }

        if (expected !== count) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_INVALID_INPUT_DATA, details:'invalid property count, expected: ' + expected + ', got : ' + count});
    }

    public isBoolean(boolean:boolean)
    {
        if (boolean === null || boolean === undefined || (typeof boolean !== 'boolean' && !((boolean as unknown) instanceof Boolean))) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_INVALID_INPUT_DATA, details:'value is not a boolean'});
    }

    public isInteger(number:number, min:number=Number.MIN_SAFE_INTEGER, max:number=Number.MAX_SAFE_INTEGER):Response | undefined
    {
        if (number === null || number === undefined || (typeof number !== 'number' && !((number as unknown) instanceof Number)) || isNaN(number) || parseInt(number.toString()) != number) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_AN_INTEGER, details:'value is not an integer'});
        if (number < min) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_INTEGER_OUT_OF_RANGE, details:'value is out of range, min ' + min + ', got: ' + number});
        if (number > max) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_INTEGER_OUT_OF_RANGE, details:'value is out of range, max ' + max + ', got: '+ number});
    }

    public isFloat(float:number, min:number=Number.MIN_VALUE, max:number=Number.MAX_VALUE):Response | undefined
    {
        if (float === null || float === undefined || (typeof float !== 'number' && !((float as unknown) instanceof Number)) || isNaN(float)) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_A_FLOAT, details:'value is not a float'});
        if (float < min) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_FLOAT_OUT_OF_RANGE, details:'value is out of range, min ' + min + ', got: ' + float});
        if (float > max) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_FLOAT_OUT_OF_RANGE, details:'value is out of range, max ' + max + ', got: '+ float});
    }

    public isCurrency(currency:number, min:number=Number.MIN_VALUE, max:number=Number.MAX_VALUE):Response | undefined
    {
        if (currency === null || currency === undefined || (typeof currency !== 'number' && !((currency as unknown) instanceof Number)) || isNaN(currency)) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_A_CURRENCY, details:'value is not a currency'});
        
        const truncatedNum = Math.floor(currency * 100) / 100;
        if (truncatedNum != currency) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_A_CURRENCY, details:'value is not a currency'});
        if (currency < min) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_CURRENCY_OUT_OF_RANGE, details:'value is out of range, min ' + min + ', got: ' + currency});
        if (currency > max) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_CURRENCY_OUT_OF_RANGE, details:'value is out of range, max ' + max + ', got: '+ currency});
    }

    public isString(string:string, min=0, max=256000):Response | undefined //default max is 128KB (assumes each character could be 4 bytes in length)
    {
        if (string === null || string === undefined || (typeof string !== 'string' && !((string as unknown) instanceof String))) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_A_STRING, details:'value is not a string'});
        if (string.length < min) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_STRING_OUT_OF_RANGE, details:'string length is out of range, min ' + min + ', got:' + string.length});
        if (string.length > max) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_STRING_OUT_OF_RANGE, details:'string length is out of range, max ' + max + ', got: ' + string.length});
    }

    public isStringBytes(string:string, min=0, max=1024000):Response | undefined //default max is 128KB
    {
        const result = this.isString(string, 0, max * 4); //up to four bytes per char
        if (result) return result;

        const size = this._app.textUtil.calculateByteSize(string);

        if (size < min) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_STRING_BYTES_OUT_OF_RANGE, details:'string byte length is out of range, min ' + min + ', got:' + size});
        if (size > max) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_STRING_BYTES_OUT_OF_RANGE, details:'string byte length is out of range, max ' + max + ', got: ' + size});
    }

    public isBase24(string:string, min=0, max=1024000):Response | undefined
    {
        const result = this.isString(string, min, max);
        if (result) return result;

        if (!base24Regex.test(string)) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_BASE24, details:'string is not base24'});
    }

    public isBase64(string:string, min=0, max=1024000):Response | undefined
    {
        const result = this.isString(string, min, max);
        if (result) return result;

        if (!base64Regex.test(string)) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_BASE64, details:'string is not base64'});
    }

    public isHex(string:string, min=0, max=1024000):Response | undefined
    {
        const result = this.isString(string, min, max);
        if (result) return result;

        if (!hexRegex.test(string)) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_HEX, details:'string is not hex'});
    }

    public isHash(hash:hex_128 | hex_160 | hex_256 | hex_384 | hex_512, encoding:HashSize):Response | undefined
    {
        switch (encoding)
        {
            case 512:
                return this.isHex(hash, 128, 128);
            case 384:
                return this.isHex(hash, 96, 96);  
            case 256:
                return this.isHex(hash, 64, 64);  
            case 160:
                return this.isHex(hash, 40, 40);
            case 128:
                return this.isHex(hash, 32, 32);
        }

        return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_A_HASH, details:'invalid hash encoding'});
    }

    public isID(id:hex_256):Response | undefined
    {
        return this.isHash(id, 256);
    }

    public isArray(array:Array<unknown>, min=0, max=10000, type:string):Response | undefined
    {
        if (array === null || array === undefined || !Array.isArray(array)) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_NOT_AN_INTEGER, details:'value is not an integer'});
        if (array.length < min) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_ARRAY_OUT_OF_RANGE, details:'array is out of range, min ' + min + ', got:' + array.length});
        if (array.length > max) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_ARRAY_OUT_OF_RANGE, details:'array is out of range, max ' + max + ', got:' + array.length});
        
        for (let i = array.length; i--;)
        {
            const value = array[i];

            if ((typeof value) !== type) return this._app.responseUtil.error({error:ErrorCode.GLOBAL_ARRAY_VALUE_TYPE_INVALID, details:'array value type invalid, expected ' + type + ', got: ' + typeof value});
        }
    }

    public isJSON(string:string):Response | undefined
    {
        let obj;

        try 
        {
            obj = JSON.parse(string);
        }
        catch (_e) {}

        return obj ? undefined : this._app.responseUtil.error({error:ErrorCode.GLOBAL_JSON_PARSE, details:'json invalid'});
    }

    public isEnum(value:unknown, enumType:Record<string, unknown>):Response | undefined
    {
        const exists = Object.values(enumType).includes(value);

        if (exists) return;
        
        return this._app.responseUtil.error({error:ErrorCode.GLOBAL_ENUM_VALUE_INVALID, details:'enum value invalid'});
    }
}
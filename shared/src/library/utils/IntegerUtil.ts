/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @reference https://learnmeabitcoin.com/technical/general/little-endian/
 * 
 * @important ALL changes to this code and dependant code must be well tested!
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";
import { __fillWithRandomIntegersWithinRange } from "./__internal/__random";

export type uint = number & {_brand:'uint'};
export type int = number & {_brand:'int'};

/**
 * The IntegerUtil class provides methods to validate and manipulate integers.
 *
 * Valid Integer Definition:
 * - Must be of type 'number'.
 * - Must be finite. It cannot be Infinity or NaN.
 * - Must be equal to its rounded version using Math.round (eliminates floating point fuzziness).
 * - Must be within the JavaScript safe integer range, i.e., greater than or equal to Number.MIN_SAFE_INTEGER 
 *   and less than or equal to Number.MAX_SAFE_INTEGER.
 *
 * These constraints ensure that the integers are precise and safe for all numerical operations within 
 * the bounds of typical JavaScript execution environments.
 */
@SealedDecorator()
export class IntegerUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Generates a cryptographically secure random integers within the specified range [min, max].
     *
     * @param {number} min - The minimum value of the generated random number (inclusive).
     * @param {number} max - The maximum value of the generated random number (inclusive).
     * @returns {number} A cryptographically secure random number within the range.
     */
    public generate(length:number, min:int | uint, max:int | uint):Int32Array;
    public generate(int32Array:Int32Array, min:int | uint, max:int | uint):void;
    public generate(min:int, max:uint):int | uint;
    public generate(min:uint, max:uint):uint;
    public generate(min:int, max:int):int;
    public generate(...args:any[])
    {
        if (args.length === 2)
        {
            const [min, max] = args;

            if (this.is(min) === false || this.is(max) === false) this._app.throw('min and max must be integers', [], {correctable:true});

            if (min > max) this._app.throw('min must be less than or equal to max', [], {correctable:true});
            if (min === max) return min;
    
            const array = new Int32Array(1);
            __fillWithRandomIntegersWithinRange(array, min, max);
    
            return array[0] as uint;
        }

        const [lengthOrInt32Array, min, max] = args;

        if (this.is(min) === false || this.is(max) === false) this._app.throw('min and max must be integers', [], {correctable:true});
        
        if (min > max) this._app.throw('min must be less than or equal to max', [], {correctable:true});
        if (min === max) return min;

        if (lengthOrInt32Array instanceof Int32Array) return __fillWithRandomIntegersWithinRange(lengthOrInt32Array, min, max);

        const array = new Int32Array(lengthOrInt32Array);
        __fillWithRandomIntegersWithinRange(array, min, max);

        return array;
    }

    /**
     * Converts a value to an integer within the specified range.
     * @param number The number to convert to an integer.
     * @param defaultValue The default value to return if the number is not an integer.
     * @param min The minimum value of the integer range.
     * @param max The maximum value of the integer range.
     * @returns The converted integer value within the specified range.
     * @throws {Error} If the default value, minimum value, or maximum value is not an integer.
     */
    public to(value:unknown, defaultValue:uint, min:uint, max:uint):uint;
    public to(value:unknown, defaultValue:int, min:int, max:int):int;
    public to(value:unknown, defaultValue:uint | int, min:int, max:uint):int | uint;
    public to(value:unknown, defaultValue:uint | int, min:number=Number.MIN_SAFE_INTEGER, max:number=Number.MAX_SAFE_INTEGER):uint | int
    {
        let number = Number(value);
        if (isNaN(number) === true) return defaultValue;

        number = Math.round(number);
        
        return Math.max(min, Math.min(max, number)) as uint | int;
    }

    /**
     * Determines whether a given number is an integer.
     * This implementation is stricter than Number.isInteger, which will interpret numbers 
     * like 5.0000000000000001 and 4500000000000000.1 as integers. We do not want that fuzzy "feature".
     * @param number The number to check.
     * @returns True if the number is an integer, false otherwise.
     */
    public is(number:unknown):number is int | uint
    {
        if (typeof number !== 'number' || !isFinite(number)) return false;

        const rounded = Math.round(number);
        return rounded === number && number <= Number.MAX_SAFE_INTEGER && number >= Number.MIN_SAFE_INTEGER;
    }

    public isSigned(number:int | uint):number is int { return number < 0 };
    public isUnsigned(number:int | uint):number is uint { return number >= 0 };

    /**
     * Converts a given unsigned integer to a Uint8Array representation.
     * 
     * This method allows for conversion of an unsigned integer within the JavaScript safe unsigned integer range
     * to an 8-byte (64 bit) Uint8Array, considering the specified endianness. The integer is split into
     * two 32-bit parts to fit into the array, as JavaScript's number type can accurately represent
     * integers up to 53 bits.
     * 
     * @reference https://learnmeabitcoin.com/technical/general/little-endian/
     *
     * @param {number} integer - The integer to convert, must be a non-negative number and within
     *                           the JavaScript safe integer range.
     * @param {boolean} [littleEndian=false] - Specifies the byte order for the conversion.
     *                                         If true, the resulting Uint8Array will be in little-endian format;
     *                                         otherwise, it will be in big-endian format.
     * @returns {Uint8Array} An 8-byte Uint8Array representing the given integer.
     * @throws {Error} If the integer is negative or not a finite number.
     */
    public toUint8Array(integer:uint, littleEndian:boolean):Uint8Array 
    {
        if (integer < 0 || integer > Number.MAX_SAFE_INTEGER) this._app.throw('integer must be greater than or equal to 0 and less than or equal to Number.MAX_SAFE_INTEGER', [], {correctable:true});

        //we store this in 8 bytes, even though we only need 7 bytes for the largest integer
        const bytes = new Uint8Array(8); //8 bytes for 64 bits
      
        //split the number into two 32-bit parts
        const high = (integer / 2**32) | 0;
        const low = integer % 2**32;
      
        if (littleEndian) 
        {
            //fill the Uint8Array, byte by byte, starting with the low part, and skipping the last byte as it will always be 0
            bytes[0] = low & 0xFF;
            bytes[1] = (low >> 8) & 0xFF;
            bytes[2] = (low >> 16) & 0xFF;
            bytes[3] = (low >> 24) & 0xFF;
            
            //then the high part
            bytes[4] = high & 0xFF;
            bytes[5] = (high >> 8) & 0xFF;
            bytes[6] = (high >> 16) & 0xFF;
        } 
        else
        {
            //for big endian, start with the high part, skipping the first byte as it will always be 0
            bytes[1] = (high >> 16) & 0xFF;
            bytes[2] = (high >> 8) & 0xFF;
            bytes[3] = high & 0xFF;
            
            //then the low part
            bytes[4] = (low >> 24) & 0xFF;
            bytes[5] = (low >> 16) & 0xFF;
            bytes[6] = (low >> 8) & 0xFF;
            bytes[7] = low & 0xFF;
        }

        return bytes;
    }
    
    public fromUint8Array(bytes:Uint8Array, littleEndian:boolean):uint
    {
        const bytesLength = bytes.length;
        
        if (bytesLength > 8) this._app.throw('bytes must not be more than 8 bytes long', [], {correctable:true});

        let value = 0;
        if (littleEndian === true) for (let i = bytesLength; i--;) value = (value * 256) + bytes[i];
        else for (let i = 0; i < bytesLength; i++) value = (value * 256) + bytes[i];
    
        if (value > Number.MAX_SAFE_INTEGER) this._app.throw('value must be less than or equal to Number.MAX_SAFE_INTEGER', [], {correctable:true});

        return value as uint;
    }

    public calculateBytesNeededToRepresent(integer:uint):uint 
    {
        if (integer < 0) this._app.throw('Integer must be greater than or equal to 0', [], {correctable:true});
        if (integer > Number.MAX_SAFE_INTEGER) this._app.throw('Integer must be less than or equal to Number.MAX_SAFE_INTEGER', [], {correctable:true});

        //at least 1 byte is needed to store 0
        if (integer === 0) return 1 as uint;
        
        //calculate the number of bits needed, then convert to bytes and round up
        return Math.ceil(Math.log2(integer + 1) / 8) as uint;
    }

    public calculateBitsNeededToRepresent(integer:uint):uint
    {
        if (integer < 0) this._app.throw('Integer must be greater than or equal to 0', [], {correctable:true});
        if (integer > Number.MAX_SAFE_INTEGER) this._app.throw('Integer must be less than or equal to Number.MAX_SAFE_INTEGER', [], {correctable:true});

        //at least 1 bit is needed to store 0
        if (integer === 0) return 1 as uint;
        
        //calculate the number of bits needed
        return Math.ceil(Math.log2(integer + 1)) as uint;
    }
}
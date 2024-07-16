/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";
import { __fillWithRandom, __MaxRepresentableSize } from "./__internal/__random";

@SealedDecorator()
export class NumberUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Generates a random number within the specified range [min, max].
     * 
     * @note Has some bias, but it should be good enough for most use cases.
     * 
     * @param min - The minimum value of the generated random number (inclusive).
     * @param max - The maximum value of the generated random number (inclusive).
     * @returns A random number within the range.
     */
    public generate(min:number, max:number):number;
    public generate(length:number, min:number, max:number):Array<number>;
    public generate(...args:any[])
    {
        const maxUint32 = 0xFFFFFFFF;

        if (args.length === 2)
        {
            const [min, max] = args;

            if (min > max) throw new Error('min must be less than or equal to max');
            if (min === max) return min;
    
            const range = max - min;
        
            const uint8Array = new Uint32Array(1);

            __fillWithRandom(uint8Array, __MaxRepresentableSize.Uint32);
      
            //use direct scaling
            const randomFloat = uint8Array[0] / (maxUint32 + 1);
    
            return (randomFloat * range) + min;
        }

        const [length, min, max] = args;

        if (min > max) throw new Error('min must be less than or equal to max');

        const array = new Array(length);
        const uint8Array = new Uint32Array(length);
        
        __fillWithRandom(uint8Array, __MaxRepresentableSize.Uint32);
        
        const range = max - min;
        for (let i = 0; i < length; i++) 
        {
            //use direct scaling
            const randomFloat = uint8Array[i] / (maxUint32 + 1);

            array[i] = (randomFloat * range) + min;
        }

        return array;
    }

    /**
     * Checks if a number is an integer within a specified range.
     * @param number The number to check.
     * @param min The minimum value of the range (default: Number.MIN_SAFE_INTEGER).
     * @param max The maximum value of the range (default: Number.MAX_SAFE_INTEGER).
     * @returns True if the number is an integer within the specified range, false otherwise.
     */
    public isWithinRange(number:number, min:number=Number.MIN_SAFE_INTEGER, max:number=Number.MAX_SAFE_INTEGER):number is number { return (!isNaN(number)) && number >= min && number <= max; }

    public clamp(number:number, min:number, max:number):number { return Math.min(Math.max(number, min), max) };

    public toUint8Array(number:number, littleEndian:boolean, size:32 | 64):Uint8Array
    {
        if (size === 32)
        {
            const buffer = new ArrayBuffer(4); //32 bits = 4 bytes
            const dataView = new DataView(buffer);
            dataView.setFloat32(0, number, littleEndian);

            return new Uint8Array(buffer);
        }

        const buffer = new ArrayBuffer(8); //64 bits = 8 bytes
        const dataView = new DataView(buffer);
        dataView.setFloat64(0, number, littleEndian);

        return new Uint8Array(buffer);
    }

    public fromUint8Array(bytes:Uint8Array, littleEndian:boolean):number
    {
        if (bytes.length === 4)
        {
            const dataView = this._app.byteUtil.toDataView(bytes);
            return dataView.getFloat32(0, littleEndian);
        }

        const dataView = this._app.byteUtil.toDataView(bytes);
        return dataView.getFloat64(0, littleEndian);
    }

    /**
     * Determines the minimum number of bytes needed to store a given number with floating-point precision.
     * It evaluates whether the number can be accurately represented as a float32. If so, 4 bytes are deemed
     * sufficient. Otherwise, it defaults to 8 bytes for float64 representation, implying that float64 is needed
     * to preserve the original value without precision loss.
     *
     * Note: This method assumes the number will be stored in a floating-point format and does not consider
     * integer or any other types of storage that might be more efficient for certain values.
     *
     * @param {number} number - The number to evaluate for storage.
     * @returns {number} The number of bytes needed to store the number with sufficient precision. 
     *                   Returns 4 for float32 compatibility, and 8 for float64 necessity.
     */
    public calculateBytesNeededToRepresent(number:number):number
    {
        const buffer = new ArrayBuffer(4); //32 bits = 4 bytes
        const dataView = new DataView(buffer);
        dataView.setFloat32(0, number, true);

        return (dataView.getFloat32(0, true) === number) ? 4 : 8;
    }
}
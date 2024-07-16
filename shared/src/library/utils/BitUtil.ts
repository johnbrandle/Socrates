/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp.ts";
import { SealedDecorator } from "../decorators/SealedDecorator.ts";
import { uint } from "./IntegerUtil.ts";
import { __MaxRepresentableSize, __fillWithRandom } from "./__internal/__random.ts";

@SealedDecorator()
export class BitUtil<A extends IBaseApp<A>>
{    
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Sets or clears a range of bits within a Uint8Array from a specified start position to an optional end position.
     * Both start and end positions are inclusive. If the end position is not specified, it defaults to the end of the array.
     * 
     * @param {Uint8Array} uint8Array The byte array in which bits are to be set or cleared.
     * @param {0 | 1} value The value to which the bits should be set (1 to set or 0 to clear).
     * @param {number} startBitPosition The zero-based index of the first bit to set or clear, inclusive.
     * @param {number} [endBitPosition] The zero-based index of the last bit to set or clear, inclusive. If undefined, it defaults to the last bit in the array.
     * @throws {Error} Throws an error if the startBitPosition is greater than the endBitPosition, or if the startBitPosition is out of the bounds of the array's bit length.
     */
    public set(uint8Array:Uint8Array, value:0 | 1, startBitPosition:uint, endBitPosition?:uint):void
    {
        endBitPosition = endBitPosition ?? (uint8Array.length * 8) - 1 as uint;

        if (startBitPosition > endBitPosition) this._app.throw('startBitPosition must be less than or equal to endBitPosition', [], {correctable:true});
        if (startBitPosition >= uint8Array.length * 8) this._app.throw('startBitPosition must be less than the total number of bits in the array', [], {correctable:true});

        let byteIndex = Math.floor(startBitPosition / 8);
        let bitIndex = 7 - (startBitPosition % 8);

        for (let i = startBitPosition; i <= endBitPosition; i++) 
        {
            if (value === 1) uint8Array[byteIndex] |= (1 << bitIndex); //set the bit to 1
            else uint8Array[byteIndex] &= ~(1 << bitIndex); //set the bit to 0
            
            bitIndex--;
            if (bitIndex < 0) 
            {
                byteIndex++;
                bitIndex = 7;
            }
        }
    }
}
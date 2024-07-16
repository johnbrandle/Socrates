/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";

@SealedDecorator()
export class BigIntUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public toUint8Array(bigIntValue:bigint, littleEndian:boolean=false):Uint8Array 
    {
        const isNegative = bigIntValue < 0;
        const absoluteValue = isNegative ? -bigIntValue : bigIntValue;

        const byteLength = (absoluteValue.toString(2).length + 7) >> 3;
        const uint8Array = new Uint8Array(byteLength + 1); //+1 for the sign byte
        
        //set the sign byte
        uint8Array[0] = isNegative ? 1 : 0;
        
        for (let i = 0; i < byteLength; i++) 
        {
            const byteIndex = littleEndian ? byteLength - i : i + 1; //+1 to adjust for the sign byte at the start
            const byte = Number((absoluteValue >> BigInt(8 * i)) & BigInt(0xFF));
            uint8Array[byteIndex] = byte;
        }
        
        return uint8Array;
    }

    public fromUint8Array(bytes:Uint8Array, littleEndian:boolean=false):bigint 
    {
        const isNegative = bytes[0] === 1;
        let value = BigInt(0);
        
        //start from 1 to skip the sign byte
        for (let i = 1; i < bytes.length; i++) 
        {
            const byteIndex:number = littleEndian ? bytes.length - i - 1 : i - 1; //-1 to adjust for the sign byte at the start
            value += BigInt(bytes[i]) << (BigInt(8 * byteIndex));
        }
        
        if (isNegative) value = -value;
        
        return value;
    }
}
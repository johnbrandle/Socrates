import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";
import { type hex } from "./BaseUtil";

/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export type bitmask = hex & { _brand:'bitmask'};

@SealedDecorator()
export class BitmaskUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Creates a bitmask string with the specified bit length, where the first N bits are set to the specified value (0 or 1) and the rest are set to 0.
     * @param {number} bitLength - The number of bits to set to the specified value.
     * @param {0 | 1} value - The value to set the first N bits to, either 0 or 1.
     * @returns {string} The resulting bitmask string in hexadecimal representation.
     * @example
     * const bitLength = 5;
     * const value = 1;
     * const bitmaskString = BitmaskUtil.create(bitLength, value); // Returns "f8"
     * const value2 = 0;
     * const bitmaskString2 = BitmaskUtil.create(bitLength, value2); // Returns "00"
     */
    public create(bitLength:number, value:0 | 1):bitmask
    {
        const numHexChars = Math.ceil(bitLength / 4); //number of hex characters required to represent the specified number of bits
        const initialBinaryString = '0'.repeat(numHexChars * 4); //initialize a binary string with the required number of zeros
        
        let flippedBinaryString = '';
        for (let i = 0; i < initialBinaryString.length; i++)
        {
            if (i < bitLength && value === 1) flippedBinaryString += initialBinaryString[i] === '0' ? '1' : '0'; //flip the bit if it's within the specified range
            else flippedBinaryString += initialBinaryString[i]; //keep the bit unchanged if it's outside the specified range
        }
        
        return parseInt(flippedBinaryString, 2).toString(16).padStart(numHexChars, '0') as bitmask; //convert the flipped binary string back to a hex string
    }      
    
    /**
     * Sets a bit to the specified value (0 or 1) at the given position in a hex string.
     * @param {number} position - The position of the bit to set, starting from 0 (left-most position).
     * @param {string} hexString - The input hex string.
     * @param {0 | 1} value - The value to set the bit to, either 0 or 1.
     * @returns {string} The updated hex string with the bit set to the specified value at the given position.
     * @example
     * const position = 0;
     * const initialHexString = '0000';
     * const value1 = 1;
     * const updatedHexString1 = BitmaskUtil.setBitAtPosition(position, initialHexString, value1); // Returns "8000"
     * const value2 = 0;
     * const updatedHexString2 = BitmaskUtil.setBitAtPosition(position, initialHexString, value2); // Returns "0000"
     */
    public setBitAtPosition(position:number, hexString:bitmask, value:0 | 1):bitmask
    {
        const numHexChars = hexString.length; //number of hex characters in the input hex string
        const initialValue = parseInt(hexString, 16); //convert the hex string to an integer
        const mask = 1 << (hexString.length * 4 - position - 1); //create a mask with a 1 bit at the specified position
        let updatedValue:number;
        if (value === 1) updatedValue = initialValue | mask; //set the bit to 1 at the specified position using bitwise OR operation 
        else updatedValue = initialValue & ~mask; //set the bit to 0 at the specified position using bitwise AND and NOT operations
        
        return updatedValue.toString(16).padStart(numHexChars, '0') as bitmask; //convert the updated value back to a hex string
    }
    
    /**
     * Gets the bit value at the specified position in a hex string.
     * @param {number} position - The position of the bit to get, starting from 0 (left-most position).
     * @param {string} hexString - The input hex string.
     * @returns {0 | 1} The value of the bit at the specified position in the hex string.
     * @example
     * const position = 0;
     * const hexString = '8000';
     * const bitValue = BitmaskUtil.getBitAtPosition(position, hexString); // Returns 1
     */
    public getBitAtPosition(position:number, hexString:bitmask):0 | 1 
    {
        const numHexChars = hexString.length; //number of hex characters in the input hex string
        const initialValue = parseInt(hexString, 16); //convert the hex string to an integer
        const mask = 1 << (numHexChars * 4 - position - 1); //create a mask with a 1 bit at the specified position
        
        return ((initialValue & mask) !== 0) ? 1 : 0; //determine if the bit is set by performing a bitwise AND operation, and return the result as 1 or 0
    }

    /**
     * Merges two bitmask strings based on the merge preference (0 or 1).
     * If the merge preference is 1, it sets the bit in the merged string to 1 if either of the corresponding bits in the input strings is 1.
     * If the merge preference is 0, it sets the bit in the merged string to 0 if either of the corresponding bits in the input strings is 0.
     *
     * @param {string} bitmaskString1 - The first bitmask string in hexadecimal representation.
     * @param {string} bitmaskString2 - The second bitmask string in hexadecimal representation.
     * @param {0 | 1} mergePreference - The merge preference, either 0 or 1.
     * @returns {string} The merged bitmask string in hexadecimal representation.
     * @example
     * const bitmaskString1 = '01';
     * const bitmaskString2 = '10';
     * const mergePreference1 = 1;
     * const mergedBitmaskString1 = BitmaskUtil.merge(bitmaskString1, bitmaskString2, mergePreference1); // Returns '3' (binary: '11')
     *
     * const bitmaskString3 = '00';
     * const bitmaskString4 = '11';
     * const mergePreference2 = 0;
     * const mergedBitmaskString2 = BitmaskUtil.merge(bitmaskString3, bitmaskString4, mergePreference2); // Returns '0' (binary: '00')
     */
    public merge(bitmaskString1:bitmask, bitmaskString2:bitmask, mergePreference: 0 | 1):bitmask
    {
        //convert hex strings to integers
        const intValue1 = parseInt(bitmaskString1, 16);
        const intValue2 = parseInt(bitmaskString2, 16);
    
        let mergedIntValue:number;
    
        if (mergePreference === 1) mergedIntValue = intValue1 | intValue2; //merge using bitwise OR operation
        else mergedIntValue = ~(~intValue1 & ~intValue2); //merge using bitwise AND and NOT operations
        
        //calculate the length of the longest hex string
        const maxLength = Math.max(bitmaskString1.length, bitmaskString2.length);
    
        //convert the merged integer value back to a hex string
        return mergedIntValue.toString(16).padStart(maxLength, '0') as bitmask;
    }  
}
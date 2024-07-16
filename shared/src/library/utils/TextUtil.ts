/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { CharSet } from "./BaseUtil";
import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";
import { uint } from "./IntegerUtil";

@SealedDecorator()
export class TextUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Generates a random string of the specified length using the specified character set.
     * 
     * @note default to secure mode, but be sure you need this because it's a lot slower.
     * 
     * @param length The length of the random string to generate.
     * @returns A random string of the specified length using the specified character set.
     */
    public generate<T extends string>(length:number, options?:{secureMode?:boolean, charset?:string}):T
    {
        const charset = options?.charset || CharSet.Base62;

        //initialize a string concatenator
        const result = this._app.stringUtil.createConcatinator();

        if (options?.secureMode === false) for (let i = length; i--;) result.append(charset[Math.floor(Math.random() * charset.length)]);
        else for (let i = length; i--;) result.append(charset[this._app.integerUtil.generate(0 as uint, charset.length - 1 as uint)]);
        
        return result.toString() as T;
    }

    public pad(input:string, length:number, padding:string=' '):string
    {
        if (input.length >= length) return input;
        else return input + padding.repeat(length - input.length);
    }

    /**
     * Encodes a string into a Uint8Array using the TextEncoder class with utf-8 encoding.
     *
     * @static
     * @param {string} input - The string to be encoded into a Uint8Array.
     * @returns {Uint8Array} The encoded Uint8Array.
     * @example
     * const inputString = "Hello World";
     * const uint8Array = YourClassName.toUint8Array(inputString);
     * console.log(uint8Array); // Output: Uint8Array(11) [72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]
     */
    public toUint8Array(input:string):Uint8Array { return new TextEncoder().encode(input) };
    
    
    /**
     * Decodes a Uint8Array into a string using the TextDecoder class with utf-8 encoding.
     * 
     * @static
     * @param {Uint8Array} input - The Uint8Array to be decoded into a string.
     * @returns {string} The decoded string.
     * @example
     * const uint8Array = new Uint8Array([72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100]); // Hello World
     * const string = YourClassName.fromUint8Array(uint8Array);
     * console.log(string); // Output: Hello World
     */
    public fromUint8Array<T extends string=string>(input:Uint8Array):T { return new TextDecoder().decode(input) as T };
    

    /**
     * Converts a string into an ArrayBuffer.
     *
     * @param {string} string - The input string to be converted.
     * @returns {ArrayBuffer} The resulting ArrayBuffer containing the UTF-8 encoded string.
     * @example
     * const myString = 'Hello, world!';
     * const myArrayBuffer = stringToArrayBuffer(myString);
     * console.log('ArrayBuffer:', myArrayBuffer);
     */
    public toArrayBuffer(string:string):ArrayBuffer { return new TextEncoder().encode(string).buffer };
    

    /**
     * Converts an ArrayBuffer into a string representation.
     *
     * @param {ArrayBuffer} buffer - The ArrayBuffer containing the binary data to be converted.
     * @returns {string} The string representation of the binary data in the input buffer.
     */
    public fromArrayBuffer<T extends string=string>(buffer:ArrayBuffer):T { return new TextDecoder().decode(buffer) as T };
    
    /**
     * Formats a number of bytes into a human-readable string representation.
     * @param bytes The number of bytes to format.
     * @param decimals The number of decimal places to include in the formatted string. If not specified, defaults to 0 for values less than 1 MB and 2 for values greater than or equal to 1 MB.
     * @returns A string representation of the number of bytes in a human-readable format.
     */
    public formatBytes(bytes:number, decimals:number=-1):string
    {
        if (!bytes) return '0 Bytes';

        const k = 1024;
        const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        if (decimals == -1)
        {
            if (i > 2) decimals = 2;
            else decimals = 0;
        }

        const value = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));

        return `${value} ${units[i]}`;
    }

    /**
     * Gets a human-readable string representing the time elapsed since a given timestamp.
     * 
     * @param timestamp The past timestamp to compare against the current time.
     * @param maxUnits The maximum number of time units to include in the output (0 for just one unit).
     * @returns A string representing the time elapsed.
     */
    public getTimeAgo(timestamp:number, maxUnits=0):string 
    {
        let difference = Math.floor((Date.now() - timestamp) / 1000); //difference in seconds

        const periods = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'decade'];
        const lengths = [1, 60, 3600, 86400, 604800, 2630880, 31570560, 315705600]; //lengths of periods in seconds
        let result = '';

        for (let unitIndex = 0; unitIndex <= maxUnits && difference > 0; unitIndex++) 
        {
            let periodIndex = lengths.length - 1;
            //find the largest time unit that fits into the difference
            while (periodIndex >= 0 && (difference / lengths[periodIndex]) <= 1) periodIndex--;
            if (periodIndex < 0) periodIndex = 0;

            const numberOfPeriods = Math.floor(difference / lengths[periodIndex]);
            difference -= numberOfPeriods * lengths[periodIndex]; //reduce the difference

            let periodName = periods[periodIndex];
            if (numberOfPeriods !== 1) periodName += 's'; //pluralize if more than one

            result += `${numberOfPeriods} ${periodName} `;
        }

        if (result === '') result = '0 seconds'; //if no period was added, return 0 seconds

        return result.trim(); //trim trailing space
    }
    
    /**
     * Calculates the number of bytes required to store a JavaScript string.
     * @function calculateByteSize
     * @param {string} string - The string for which the byte size has to be calculated.
     * @returns {number} - The number of bytes required to store the string.
     */
    public calculateByteSize(string:string):number { return new TextEncoder().encode(string).length };

    /**
     * Capitalizes the first letter of a string.
     * @param string - The string to capitalize.
     * @returns The capitalized string.
     */
    public capitalize(string:string):string { return string.charAt(0).toUpperCase() + string.slice(1) };

    /**
     * Compares two strings using the current locale's collation rules.
     * 
     * @note this is not a constant time comparison, so don't use it for security purposes.
     * 
     * @param a - The first string to compare.
     * @param b - The second string to compare.
     * @returns A number indicating the sort order of the two strings.
     */
    public compare(a:string, b:string):number { return a.localeCompare(b) };
}
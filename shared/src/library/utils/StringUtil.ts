/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";

export type emptystring = '';

@SealedDecorator()
export class StringUtil<A extends IBaseApp<A>>
{    
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Returns a new instance of StringConcatinator with an optional initial string.
     * @param string - Optional initial string to concatenate to.
     * @returns A new instance of StringConcatinator.
     */
    public createConcatinator(string?:string):StringConcatinator { return new StringConcatinator(string) };

    /**
     * Checks if a string is empty or not.
     * @param string - The string to check.
     * @returns Returns true if the string is empty, false otherwise.
     */
    public isEmpty(string:string):string is emptystring { return string === '' };
}

/**
 * Rationale for the StringConcatinator Class Implementation:
 * 
 * Performance Considerations in Chromium:
 * - In Chromium, the performance of string concatenation generally equals or significantly outperforms using an array followed by `.join()`.
 * - This remains true regardless of the number of concatenations or the overall length of the string.
 * - The primary factor affecting array performance appears to be the size of the string segments being concatenated. Larger segments slow down array concatenation, while string concatenation performance remains more or less constant.
 * 
 * Browser Compatibility and Future-Proofing:
 * - Performance characteristics could differ in other browsers such as Firefox and Safari or in future versions of Chromium.
 * - Implementing concatenation as an abstraction within this class enables easy switching of concatenation methods without impacting the code that relies on this class.
 * 
 * Additional Chromium Observations:
 * - Using a fixed-size array with string concatination is significantly slower in Chromium as compared to a dynamically sized array. No idea why...
 * - When using a dynamically sized array and concatenating single characters, the performance seems to match that of direct string concatenation.
 * 
 * Conclusion:
 * - Given that string concatenation has consistent performance and allows for potential future-proofing, it is used as the concatenation method in this implementation.
 * 
 * Note: this does not use arrow functions because they are significantly slower in Chromium.
 */
@SealedDecorator()
class StringConcatinator
{
    #string:string;

    constructor(string?:string) { this.#string = string ?? ''; }

    public prepend(string:string):void { this.#string = string + this.#string };
    public append(string:string):void { this.#string += string };
    public splice(start:number, deleteCount:number):void 
    { 
        this.#string = this.#string.slice(0, start) + this.#string.slice(start + deleteCount);
    }
    public toString():string { return this.#string };
    public get length():number { return this.#string.length; }
}
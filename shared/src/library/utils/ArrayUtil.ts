/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";
import { Hex_96 } from "./HashUtil";
import { uint } from "./IntegerUtil";

const MutableSymbol = Symbol('Mutable');

@SealedDecorator()
export class ArrayUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Converts any iterable or array-like object into an array.
     *
     * @template T
     * @param {any} obj - The object to convert to an array.
     * @returns {T[]} The resulting array.
     */
    public to<T>(obj:any):T[] { return Array.from(obj) };

    /**
     * Distributes the contents of an array into smaller arrays, ensuring that the arrays are close to the same size.
     *
     * @param {string[]} array - The contents to be distributed.
     * @param {number} maxLength - The maximum allowed length for each sub-array.
     * @returns {string[][]} An array of sub-arrays containing the evenly distributed contents.
     *
     * @example
     * const inputArray = ['apple', 'banana', 'cherry', 'dates', 'fig', 'grapes', 'kiwi'];
     * const maxLength = 3;
     * const outputArrays = distribute(inputArray, maxLength);
     * ConsoleUtil.log(outputArrays);
     * // Output: [ [ 'apple', 'banana', 'cherry' ], [ 'dates', 'fig' ], [ 'grapes', 'kiwi' ] ]
     */
    public distribute<T>(array:T[], maxLength:number):T[][]
    {
        if (maxLength <= 0) this._app.throw('The maxLength must be greater than 0', [], {correctable:true});
        if (maxLength > array.length) maxLength = array.length;
        
        const numOfArrays = Math.round(array.length / maxLength);
        const baseLength = Math.floor(array.length / numOfArrays);
        const remaining = array.length % numOfArrays;
      
        const result = [];
      
        let currentIndex = 0;
        for (let i = 0; i < numOfArrays; i++) 
        {
            const subArrayLength = baseLength + (i < remaining ? 1 : 0);
            const subArray = array.slice(currentIndex, currentIndex + subArrayLength);
            result.push(subArray);
          
            currentIndex += subArrayLength;
        }
      
        return result;
    }

    /**
     * Shuffles an array using the Fisher-Yates algorithm with cryptographically secure random numbers.
     *
     * @param {Array} array - The input array to be shuffled.
     * @returns {void}
     *
     * @example
     * const inputArray = [1, 2, 3, 4, 5, 6, 7, 8, 9];
     * const shuffledArray = shuffle(inputArray);
     * ConsoleUtil.log(shuffledArray);
     */
    public randomize<T>(array:T[]):void;
    public randomize<T>(array:T[], options?:{salt?:Hex_96}):Promise<void>;
    public randomize<T>(array:T[], options?:{salt?:Hex_96}):Promise<void> | void 
    {
        const length = array.length; 

        if (length <= 1) return;

        const salt = options?.salt;
        
        if (salt === undefined)
        {
            const randomIntegers = this._app.integerUtil.generate(length as uint, 0 as uint, length - 1 as uint);
        
            for (let i = length; i--;) 
            {
                const j = randomIntegers[i];
        
                //swap the elements.
                [array[i], array[j]] = [array[j], array[i]];
            }

            return;
        }

        return this._app.keyUtil.__CTR_KEY.then(ctrKey => this._app.byteUtil.derive(ctrKey, salt, length * 4).then((derivedBytes) =>
        {
            const min = 0;
            const max = length - 1;
            const range = max - min + 1;

            //verify the range is a power of two if a salt is provided.
            if ((range & (range - 1)) !== 0) this._app.throw('The array must be a power of two if a salt is provided', [], {correctable:true});

            const derivedIntegers = new Int32Array(derivedBytes);
            
            for (let i = length; i--;) 
            {
                const j = (derivedIntegers[i] % range) + min;
        
                //swap the elements.
                [array[i], array[j]] = [array[j], array[i]];
            }
        }));
    }

    public getRandomValue<T>(array:T[]):T
    {
        if (array.length === 0) this._app.throw('The array must not be empty', [], {correctable:true});

        const index = this._app.integerUtil.generate(0 as uint, array.length - 1 as uint);
        
        return array[index];
    }

    public concat<T>(array:T[][]):T[]
    {
        return array.reduce((acc, val) => acc.concat(val), []);
    }

    /**
     * Makes an array immutable by wrapping it with a Proxy object (only in debug mode).
     * If isDebug is true, attempts to modify or delete properties will throw an error.
     * @param array - The array to make immutable.
     * @returns A readonly version of the input array.
     */
    public makeImmutable<T>(array:T[]):ReadonlyArray<T>
    {
        if (this._app.debugUtil.isDebug !== true) return array;

        const app = this._app;

        return new Proxy(array, 
        {
            set(_target, _property, _value) 
            {
                return app.throw('Array is immutable', [], {correctable:true});
            },
            deleteProperty() 
            {
                return app.throw('Array is immutable', [], {correctable:true});
            },
            get(target, property, receiver)
            {
                if (property === MutableSymbol) return array; //allow access to the mutable array

                return Reflect.get(target, property, receiver);
            }
        }) as ReadonlyArray<T>;
    }

    /**
     * Returns the original mutable version of the input array.
     * @param array - The input array.
     * @returns A original version of the input array.
     */
    public getMutable<T>(array:ReadonlyArray<T>):T[]
    {
        if (this._app.debugUtil.isDebug !== true) return array as T[];

        const value = (array as any)[MutableSymbol];
        if (value === undefined) this._app.throw('Array is immutable', [], {correctable:true});

        return value;
    }
}
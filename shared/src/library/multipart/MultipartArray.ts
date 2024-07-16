/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { SealedDecorator } from "../decorators/SealedDecorator";

/**
 * @verifyInterfacesTransformer_ignore
 */
@SealedDecorator()
@ImplementsDecorator()
export class MultipartArray<T> implements Array<T>
{
    private _arrays:Array<T[]>;
    private _options:{totalLength?:number, removeEmptyArrays?:boolean, splitThreshold?:number};
    private _length:number = -1;

    constructor(arrays?:Array<T[]>, options?:{totalLength?:number, removeEmptyArrays?:boolean, splitThreshold?:number})
    {
        this._arrays = arrays = arrays ?? [[]];
        this._options = options = options ?? {};

        let length;
        if (options?.totalLength === undefined)
        {
            length = 0;
            for (const array of this._arrays) length += array.length;
        }
        else length = options.totalLength;
        this._length = length;

        const proxy:MultipartArray<T> = new Proxy(arrays, 
        {
            get:this.__get,
            set:this.__set,
            deleteProperty:(target, property) => this.__delete(target, property, proxy)
        }) as unknown as MultipartArray<T>;

        return proxy;
    }

    public __get = (arrays:Array<T[]>, property:string | symbol, proxy:MultipartArray<T>) => 
    {
        switch (property)
        {
            case 'length':return this.length;
            case 'toString':return this.toString;
            case 'sort':(compareFn?:(a:T, b:T) => number):MultipartArray<T> => { this.sort(compareFn); return proxy; };
            case 'splice':return this.splice;
            case 'slice':return this.slice;
            case 'push':return this.push;
            case 'filter':return (callbackfn:(value:T, index:number) => boolean):Array<T> => this.#filter(callbackfn, proxy);

            case 'optimize':return this.optimize; //this may not be an optimization at all. really depends on the use case
        }
        
        if (typeof property === 'string') 
        {
            const index = parseInt(property);
            if (isNaN(index)) throw new Error('Invalid index');

            return this.at(index);
        }

        if (property === Symbol.iterator) return this[Symbol.iterator].bind(this);

        throw new Error('invalid property name');
    }

    public __set = (arrays:Array<T[]>, property:string | symbol, value:T, proxy:MultipartArray<T>):boolean =>
    {
        
        if (typeof property === 'string') 
        {
            const index = parseInt(property);
            if (isNaN(index)) throw new Error('Invalid index');

            let currentIndex = 0;
            for (const array of arrays) 
            {
                const totalLength = currentIndex + array.length;

                if (index >= totalLength) 
                {
                    currentIndex = totalLength;
                    continue;
                }

                const localIndex = index - currentIndex;

                //check if we're extending the array
                if (localIndex >= array.length) 
                {
                    //calculate the increase in length
                    const lengthIncrease = localIndex - array.length + 1;
                    this._length += lengthIncrease;
                }

                array[localIndex] = value;

                return true;
            }
        }

        throw new Error('invalid property name'); 
    }

    public __delete = (arrays:Array<T[]>, property:string | symbol, proxy:MultipartArray<T>) =>
    {
        if (typeof property === 'string') 
        {
            const options = this._options;

            const index = parseInt(property);
            if (isNaN(index)) throw new Error('Invalid index');

            let cumulativeLength = 0;
            let i = 0;
            for (const array of arrays)
            {
                ++i;

                const totalLength = cumulativeLength + array.length;

                if (index >= totalLength) 
                {
                    cumulativeLength = totalLength;
                    continue;
                }

                const localIndex = index - cumulativeLength;

                delete array[localIndex];
                
                return true;
            }
        }

        throw new Error('invalid property name');
    }

    //index signature
    [index:number]:T;

    get length():number { return this._length; }
    
    //@ts-ignore
    set length(value:number) {}

    //@ts-ignore
    concat(...items:ConcatArray<T>[]):T[] {}
    
    //@ts-ignore
    copyWithin(target:number, start:number, end?:number):this {}
    
    //@ts-ignore
    entries():IterableIterator<[number, T]> {}

    //@ts-ignore
    every(callbackfn:(value:T, index:number, array:T[]) => unknown, thisArg?:any):boolean {}

    //@ts-ignore
    fill(value:T, start?:number, end?:number):this {}

    //@ts-ignore
    filter = (callbackfn:(value:T, index:number, array:T[]) => unknown):T[] => {}
    #filter = (callbackfn:(value:T, index:number, array:MultipartArray<T>) => unknown, proxy:MultipartArray<T>):T[] => 
    {
        const arrays = this._arrays;

        const resultArrays:Array<Array<T>> = [];
        let index = 0;

        for (const array of arrays) 
        {
            const filteredArray = array.filter((element) => callbackfn(element, index++, proxy));
            if (filteredArray.length > 0) resultArrays.push(filteredArray);
        }

        return resultArrays.flat(1);
    }

    //@ts-ignore
    find(callbackfn:(value:T, index:number, obj:T[]) => unknown, thisArg?:any):T | undefined {}

    //@ts-ignore
    findIndex(callbackfn:(value:T, index:number, obj:T[]) => unknown, thisArg?:any):number {}

    //@ts-ignore
    flat<U>(this:U, depth?:number):any[] {}

    //@ts-ignore
    flatMap<U>(callbackfn:(value:T, index:number, array:T[]) => U | readonly U[], thisArg?:any):U[] {}

    //@ts-ignore
    forEach(callbackfn:(value:T, index:number, array:T[]) => void, thisArg?:any):void {}

    //@ts-ignore
    includes(searchElement:T, fromIndex?:number):boolean {}

    //@ts-ignore
    indexOf(searchElement:T, fromIndex?:number):number {}

    //@ts-ignore
    join(separator?:string):string {}

    //@ts-ignore
    keys():IterableIterator<number> {}

    //@ts-ignore
    lastIndexOf(searchElement:T, fromIndex?:number):number {}

    //@ts-ignore
    map<U>(callbackfn:(value:T, index:number, array:T[]) => U, thisArg?:any):U[] {}

    //@ts-ignore
    pop():T | undefined {}

    push = (...items:T[]):number => 
    {
        const length = this._length;
        this.splice(length, 0, ...items);
        
        return length + items.length;
    }

    //@ts-ignore
    reduce(callbackfn:(previousValue:T, currentValue:T, currentIndex:number, array:T[]) => T):T {}

    //@ts-ignore
    reduce<U>(callbackfn:(previousValue:U, currentValue:T, currentIndex:number, array:T[]) => U, initialValue:U):U {}

    //@ts-ignore
    reduceRight(callbackfn:(previousValue:T, currentValue:T, currentIndex:number, array:T[]) => T):T {}

    //@ts-ignore
    reduceRight<U>(callbackfn:(previousValue:U, currentValue:T, currentIndex:number, array:T[]) => U, initialValue:U):U {}

    //@ts-ignore
    reverse():T[] {}

    //@ts-ignore
    shift():T | undefined {}

    slice = (start?:number, end?:number):T[] => 
    {
        const arrays = this._arrays;
        const totalLength = this._length;

        start = start ?? 0;
        end = end ?? totalLength;

        if (start < 0) start = totalLength + start;
        if (start < 0) start = 0;
        if (end < 0) end = totalLength + end;
        if (end < 0) end = 0;
        
        let remainingStart = start;
        let remainingEnd = end;
        let result:Array<T> = [];

        //if start is greater than or equal to end, or start is beyond total length, return empty array
        if (start >= end || start >= totalLength) return result;
        
        //iterate over each array and extract the required elements
        let index = 0;
        for (const array of arrays) 
        {
            if (remainingStart < array.length) 
            {
                const localEnd = Math.min(array.length, remainingEnd);
                
                for (let i = remainingStart; i < localEnd; i++) result[index++] = array[i];
                remainingEnd -= (localEnd - remainingStart);
                if (remainingEnd === 0) break;
            }
            
            remainingStart = Math.max(0, remainingStart - array.length);
        }

        return result;
    }

    //@ts-ignore
    some(callbackfn:(value:T, index:number, array:T[]) => unknown, thisArg?:any):boolean {}

    sort = (compareFn?:(a:T, b:T) => number):this =>
    {
        const arrays = this._arrays;

        if (arrays.length === 1) 
        {
            arrays[0].sort(compareFn);
            
            return this;
        }

        const combinedArray = arrays.flat(1);
        combinedArray.sort(compareFn);

        arrays.length = 1;
        arrays[0] = combinedArray;

        return this;
    }

    splice = (start:number, deleteCount?:number, ...items:T[]):T[] =>
    {
        const totalLength = this._length;
        const arrays = this._arrays;
        const options = this._options;

        //adjust the start index 
        if (start < 0) start = totalLength + start;
        if (start < 0) start = 0;
        if (start > totalLength) start = totalLength;

        //set deleteCount to the remaining length from start if it's not provided
        deleteCount = deleteCount ?? totalLength - start;
        if (start + deleteCount > totalLength) deleteCount = totalLength - start;
        if (deleteCount < 0) deleteCount = 0;
        
        let toDeleteCount = deleteCount;
        const deleted:Array<T[]> = [];

        //check if it's a simple replacement case (equal delete and insert counts)
        if (deleteCount === items.length)
        {
            if (deleteCount === 0) return [];

            let toInsertCount = items.length;
            
            //now handle insertion
            let cumulativeLength = 0;
            for (const array of arrays) 
            {
                const arrayLength = array.length;
                const totalLength = cumulativeLength + arrayLength;

                if (start > totalLength) 
                {
                    cumulativeLength = totalLength;
                    continue;
                }

                const localStart = start - cumulativeLength;
                const localInsertCount = Math.min(toInsertCount, arrayLength - localStart);
                const end = localStart + localInsertCount;
                for (let j = localStart; j < end; j++) array[j] = items[j - localStart];
                
                cumulativeLength = totalLength;
                toInsertCount -= localInsertCount;

                if (toInsertCount === 0) break;
            }
        }        

        let toInsertCount = items.length;
        
        //handle deletion (possibly combined with insertion)
        if (toDeleteCount > 0 && toDeleteCount !== items.length)
        {
            let cumulativeLength = 0;
            for (let i = 0, length = arrays.length; i < length; i++) 
            {
                const array = arrays[i];

                const arrayLength = array.length;
                const totalLength = cumulativeLength + arrayLength;

                if (start >= totalLength) 
                {
                    cumulativeLength = totalLength;
                    continue;
                }

                //calculate the local start index within the current array
                const localStart = start - cumulativeLength;

                //determine the number of elements to delete from the current array
                const localDeleteCount = Math.min(toDeleteCount, arrayLength - localStart);

                //update the remaining global delete count
                toDeleteCount -= localDeleteCount;
                
                //check if there are items to insert
                if (toInsertCount > 0) 
                {
                    //determine the number of items to insert in this iteration
                    //if there are no more items to delete, insert all remaining items
                    //otherwise, insert as many items as we are deleting in this step
                    const insertCount = toDeleteCount === 0 ? toInsertCount : Math.min(toInsertCount, localDeleteCount);

                    //perform the splice operation: delete localDeleteCount items from localStart
                    //and insert insertCount items from the items array
                    deleted.push(array.splice(localStart, localDeleteCount, ...items.splice(0, insertCount)));

                    //update the remaining global insert count
                    toInsertCount -= insertCount;
                }
                else deleted.push(array.splice(localStart, localDeleteCount)); //if no items left to insert, just perform the deletion

                //handle the removal of empty arrays if specified in options
                if (array.length === 0 && arrays.length > 1 && options?.removeEmptyArrays === true) 
                {
                    arrays.splice(i, 1);
                    i--;
                    length--;
                }
                else cumulativeLength += array.length;

                //exit the loop if all deletions are done
                if (toDeleteCount === 0) break;                
            } 
        }

        //now handle insertion only scenarios
        if (toInsertCount > 0)
        {
            let cumulativeLength = 0;
            for (const array of arrays)
            {
                const totalLength = cumulativeLength + array.length;

                if (start > totalLength) 
                {
                    cumulativeLength = totalLength;
                    continue;
                }

                const localStart = start - cumulativeLength;
                array.splice(localStart, 0, ...items);
                break;
            }
        }

        this._length = (totalLength + items.length) - deleteCount; //set the new length

        //return the flattened array of deleted elements
        return deleted.flat(1);
    }

    //@ts-ignore
    toLocaleString():string {}

    toString = ():string => this._arrays.flat(1).toString();

    //@ts-ignore
    unshift(...items:T[]):number {}

    //@ts-ignore
    values():IterableIterator<T> {}

    /**
     * Creates a generator function for iterating over a collection of arrays.
     * This generator allows traversing through all elements in the collection, starting
     * from a specified start index, and optionally up to an end index, yielding one element at a time.
     *
     * The 'consistencyMode' option within the 'options' parameter determines the behavior of the generator
     * in relation to the consistency of the iteration:
     * - Mode 0: Collects elements first into a result array and yields them after completing the entire iteration.
     *   This mode provides a consistent snapshot of the elements at the start of iteration, suitable for scenarios
     *   where data consistency is crucial. It is more memory-intensive as it stores all elements before yielding.
     * - Mode 1: Yields a copied slice of the elements for each array in the collection, ensuring consistency within
     *   each array while not accumulating all elements at once. This mode balances consistency and memory usage.
     * - Mode 2: Yields elements directly from the arrays, reflecting real-time changes in the underlying data.
     *   This mode is the most memory-efficient but can yield inconsistent results if the underlying data changes 
     *   during iteration. Suitable for scenarios where immediate data reflection is more important than consistency,
     *   or when you're sure the data won't change during iteration. Do not use in awaited scenarios!
     * 
     *
     * @template T - The type of elements in the arrays.
     * @param {number} [startIndex=0] - The zero-based offset from which to start iteration.
     * @param {number} [endIndex] - Optional parameter to specify where to end the iteration.
     * @param {0|1|2} [consistencyMode=0] - Determines the consistency mode of the iterator.
     *        Default is '0' for a consistent snapshot of all elements.

     * @returns {Generator<T, void, unknown>} - A generator that yields elements from the collection of arrays.
     */
    *[Symbol.iterator](startIndex:number=0, endIndex?:number, consistencyMode:0|1|2=0):Generator<T, void, unknown>
    {
        yield* MultipartArray.values(this._arrays, this._length, startIndex, endIndex, consistencyMode);
    }

    public static *values<T>(arrays:Array<T[]>, totalLength:number, startIndex:number=0, endIndex?:number, consistencyMode:0|1|2=0):Generator<T, void, unknown>
    {
        if (startIndex < 0) startIndex = Math.max(0, totalLength + startIndex);
        if (endIndex !== undefined && endIndex < 0) endIndex = Math.max(0, totalLength + endIndex);

        const result:T[] = [];
        let resultIndex = 0;

        let cumulativeLength = 0;
        for (const array of arrays) 
        {
            const totalLength = cumulativeLength + array.length;

            if (startIndex >= totalLength)
            {
                cumulativeLength = totalLength;
                continue;
            }

            const localStartIndex = Math.max(0, startIndex - cumulativeLength);
            const localEndIndex = endIndex !== undefined ? Math.min(array.length, endIndex - cumulativeLength) : array.length;

            switch (consistencyMode)
            {
                case 0:
                    for (let i = localStartIndex; i < localEndIndex; i++) result[resultIndex++] = array[i]; //copy into the result array for consistency.
                    break;
                case 1:
                    const items = array.slice(localStartIndex, localEndIndex); //slice first for consistency
                    for (const item of items) yield item; //yield each item
                    break;
                case 2:
                    for (let i = localStartIndex; i < localEndIndex; i++) yield array[i]; //yield each item directly
                    break;
            }

            cumulativeLength = totalLength;
        }

        if (consistencyMode === 0) for (const item of result) yield item; //yield each item from the result array.
    }
    
    //@ts-ignore
    [Symbol.unscopables](): 
    {
        copyWithin:boolean;
        entries:boolean;
        fill:boolean;
        find:boolean;
        findIndex:boolean;
        flat:boolean;
        flatMap:boolean;
        includes:boolean;
        keys:boolean;
        values:boolean;
    } {
        return {
            copyWithin:true,
            entries:true,
            fill:true,
            find:true,
            findIndex:true,
            flat:true,
            flatMap:true,
            includes:true,
            keys:true,
            values:true,
        };
    }

    at(index:number):T | undefined
    {
        const arrays = this._arrays;

        let cumulativeLength = 0;
        for (const array of arrays)
        {
            const totalLength = cumulativeLength + array.length;

            if (index >= totalLength) 
            {
                cumulativeLength = totalLength;
                continue;
            }

            const localIndex = index - cumulativeLength;

            return array[localIndex];
        }

        return undefined;
    }

    public optimize():void 
    { 
        const _arrays = this._arrays;
        const _options = this._options;

        if (_options.splitThreshold === undefined) return;

        const halfOfThreshold = _options.splitThreshold / 2;
        for (let i = 0, length = _arrays.length; i < length; i++)
        {
            const array = _arrays[i];
            if (array.length > _options.splitThreshold)
            {
                const first = array.slice(0, halfOfThreshold);
                const second = array.splice(halfOfThreshold);
                _arrays.splice(i, 1, first, second);
                i++;
                length++;
            }
            else if (array.length < halfOfThreshold && length > 1) //merge small arrays if a threshold is specified
            {
                const previousArray = _arrays[i - 1];
                const nextArray = _arrays[i + 1];
                if (previousArray && previousArray.length + array.length < halfOfThreshold) 
                {
                    previousArray.push(...array);
                    _arrays.splice(i, 1);
                    i--;
                    length--;
                }
                else if (nextArray && nextArray.length + array.length < halfOfThreshold) 
                {
                    nextArray.unshift(...array);
                    _arrays.splice(i, 1);
                    i--;
                    length--;
                }
            }
        }
    }
}
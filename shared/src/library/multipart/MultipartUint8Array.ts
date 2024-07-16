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
export class MultipartUint8Array implements Uint8Array
{
    private _arrays:Array<Uint8Array>;
    private _options:{totalLength?:number};
    private _length:number = -1;

    constructor(arrays?:Array<Uint8Array>, options?:{totalLength?:number})
    {
        this._arrays = arrays = arrays ?? [];
        this._options = options = options ?? {};

        let length;
        if (options?.totalLength === undefined)
        {
            length = 0;
            for (const array of this._arrays) length += array.length;
        }
        else length = options.totalLength;
        this._length = length;

        const proxy:MultipartUint8Array = new Proxy(arrays, 
        {
            get:this.__get,
            set:this.__set,
            deleteProperty:(target, property) => this.__delete(target, property, proxy)
        }) as unknown as MultipartUint8Array;

        return proxy;
    }

    public __get = (arrays:Array<Uint8Array>, property:string | symbol, proxy:MultipartUint8Array) => 
    {
        switch (property)
        {
            case 'length':return this.length;
            case 'toString':return this.toString;
            case 'splice':return this.splice;
            case 'slice':return this.slice;
            case 'push':return this.push;
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

    public __set = (arrays:Array<Uint8Array>, property:string | symbol, value:number, proxy:MultipartUint8Array):boolean =>
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
                    this.splice(index, 0, new Uint8Array(lengthIncrease));
                }

                array[localIndex] = value;

                return true;
            }
        }

        throw new Error('invalid property name'); 
    }

    public __delete = (arrays:Array<Uint8Array>, property:string | symbol, proxy:MultipartUint8Array) =>
    {
        if (typeof property === 'string') 
        {
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

                array[localIndex] = 0;
                
                return true;
            }
        }

        throw new Error('invalid property name');
    }

    get length():number { return this._length; }
    
    //@ts-ignore
    set length(value:number) {}

    //@ts-ignore
    concat(...items:ConcatArray<Uint8Array>[]):Uint8Array {}
    
    //@ts-ignore
    copyWithin(target:number, start:number, end?:number):this {}
    
    //@ts-ignore
    entries():IterableIterator<[number, Uint8Array]> {}

    //@ts-ignore
    every(callbackfn:(value:number, index:number, array:Uint8Array) => unknown):boolean {}

    //@ts-ignore
    fill(value:number, start?:number, end?:number):this {}

    //@ts-ignore
    filter = (callbackfn:(value:number, index:number, array:Uint8Array) => unknown):Uint8Array => {}

    //@ts-ignore
    find(callbackfn:(value:number, index:number, obj:Uint8Array) => unknown):number | undefined {}

    //@ts-ignore
    findIndex(callbackfn:(value:number, index:number, obj:Uint8Array) => unknown):number {}

    //@ts-ignore
    flat<U>(this:U, depth?:number):any[] {}

    //@ts-ignore
    flatMap<U>(callbackfn:(value:number, index:number, array:Uint8Array) => U | readonly U[]):U[] {}

    //@ts-ignore
    forEach(callbackfn:(value:number, index:number, array:Uint8Array) => void):void {}

    //@ts-ignore
    includes(searchElement:number, fromIndex?:number):boolean {}

    //@ts-ignore
    indexOf(searchElement:number, fromIndex?:number):number {}

    //@ts-ignore
    join(separator?:string):string {}

    //@ts-ignore
    keys():IterableIterator<number> {}

    //@ts-ignore
    lastIndexOf(searchElement:number, fromIndex?:number):number {}

    //@ts-ignore
    map<U>(callbackfn:(value:number, index:number, array:Uint8Array) => U, thisArg?:any):U[] {}

    //@ts-ignore
    pop():number | undefined {}

    push = (...items:number[] | Uint8Array[]):number => 
    {
        const length = this._length;
        this.splice(length, 0, ...items);
        
        return length + items.length;
    }

    //@ts-ignore
    reduce(callbackfn:(previousValue:number, currentValue:number, currentIndex:number, array:Uint8Array) => number):number {}

    //@ts-ignore
    reduce<U>(callbackfn:(previousValue:U, currentValue:number, currentIndex:number, array:Uint8Array) => U, initialValue:U):U {}

    //@ts-ignore
    reduceRight(callbackfn:(previousValue:number, currentValue:number, currentIndex:number, array:Uint8Array) => number):number {}

    //@ts-ignore
    reduceRight<U>(callbackfn:(previousValue:U, currentValue:number, currentIndex:number, array:Uint8Array) => U, initialValue:U):U {}

    //@ts-ignore
    reverse():Uint8Array {}

    //@ts-ignore
    shift():number | undefined {}

    slice = (start?:number, end?:number):Uint8Array => 
    {
        const arrays = this._arrays;
        const totalLength = this._length;

        start = start ?? 0;
        end = end ?? totalLength;

        //adjust the start index 
        if (start < 0) start = totalLength + start;
        if (start < 0) start = 0;
        if (start > totalLength) start = totalLength;

        let remainingStart = start;
        let remainingEnd = end;
        let result = new Uint8Array(end - start);
        let resultIndex = 0;

        for (let array of arrays) 
        {
            if (remainingStart < array.length) 
            {
                let localEnd = Math.min(array.length, remainingEnd);
                let length = localEnd - remainingStart;
                result.set(array.subarray(remainingStart, localEnd), resultIndex);
                resultIndex += length;
                remainingEnd -= length;
                if (remainingEnd === 0) break;
            }
            
            remainingStart = Math.max(0, remainingStart - array.length);
        }

        return result;
    }

    //@ts-ignore
    some(callbackfn:(value:number, index:number, array:Uint8Array) => unknown):boolean {}

    //@ts-ignore
    sort = (compareFn?:(a:number, b:number) => number):this => {}

    splice = (start:number, deleteCount?:number, ...items:(number[] | Uint8Array[])):Uint8Array =>
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
        const deleted:Array<Uint8Array> = [];

        let itemsToAddParts:Uint8Array[];
        if (items.length > 0)
        {
            if (items[0] instanceof Uint8Array) itemsToAddParts = items as Uint8Array[];
            else itemsToAddParts = [new Uint8Array(items as number[])];
        }
        else itemsToAddParts = [];

        let itemsToAdd = this.#concat(itemsToAddParts);
        
        //check if it's a simple replacement case (equal delete and insert counts)
        if (deleteCount === itemsToAdd.length)
        {
            if (deleteCount === 0) return new Uint8Array(0);

            let toInsertCount = itemsToAdd.length;
            
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
                for (let j = localStart; j < end; j++) array[j] = itemsToAdd[j - localStart];
                
                cumulativeLength = totalLength;
                toInsertCount -= localInsertCount;

                if (toInsertCount === 0) break;
            }
        }        

        let toInsertCount = itemsToAdd.length;
        
        //handle deletion (possibly combined with insertion)
        if (toDeleteCount > 0 && toDeleteCount !== itemsToAdd.length)
        {
            let cumulativeLength = 0;
            for (let i = 0, length = arrays.length; i < length; i++) 
            {
                let array = arrays[i];

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

                    //first get the items we want to add
                    const toAdd = itemsToAdd.slice(0, insertCount);
                    itemsToAdd = itemsToAdd.slice(insertCount); //remove the items we're adding from the items to add array

                    //remove the begging of the array
                    const beginning = array.slice(0, localStart);

                    //remove the end of the array
                    const end = array.slice(localStart + localDeleteCount); 

                    if (beginning.length === 0 && end.length === 0) arrays[i] = toAdd;
                    else if (beginning.length === 0) arrays[i] = this.#concat([toAdd, end]);
                    else if (end.length === 0) arrays[i] = this.#concat([beginning, toAdd]);
                    else arrays[i] = this.#concat([beginning, toAdd, end]);

                    deleted.push(array.slice(localStart, localDeleteCount)); //deleted.push(array.splice(localStart, localDeleteCount, ...items.splice(0, insertCount)));

                    array = arrays[i];

                    //update the remaining global insert count
                    toInsertCount -= insertCount;
                }
                else 
                {
                    //remove the begging of the array
                    const beginning = array.slice(0, localStart);

                    //remove the end of the array
                    const end = array.slice(localStart + localDeleteCount);

                    if (beginning.length === 0) arrays[i] = end;
                    else if (end.length === 0) arrays[i] = beginning;
                    else arrays[i] = this.#concat([beginning, end]);

                    deleted.push(array.slice(localStart, localDeleteCount)); //if no items left to insert, just perform the deletion

                    array = arrays[i];
                }
                //handle the removal of empty arrays
                if (array.length === 0 && arrays.length > 1) 
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
            let added = false;
            let cumulativeLength = 0;
            let i = 0;
            for (const array of arrays)
            {
                const totalLength = cumulativeLength + array.length;

                if (start > totalLength) 
                {
                    cumulativeLength = totalLength;
                    i++;
                    continue;
                }

                const localStart = start - cumulativeLength;

                //split the array into two parts: before and after the insertion point
                const before = array.slice(0, localStart);
                const after = array.slice(localStart);

                if (before.length === 0) arrays.splice(i, 0, itemsToAdd, after);
                else if (after.length === 0) arrays.splice(i, 0, before, itemsToAdd);
                else arrays.splice(i, 0, before, itemsToAdd, after);
                added = true;
                break;
            }

            if (added === false) arrays.push(itemsToAdd);
        }

        this._length = (totalLength + itemsToAdd.length) - deleteCount; //set the new length

        //return the flattened array of deleted elements
        return this.#concat(deleted);
    }

    //@ts-ignore
    subarray(begin:number, end?:number):Uint8Array {}

    //@ts-ignore
    toLocaleString():string {}

    toString = ():string => this._arrays.flat(1).toString();

    //@ts-ignore
    unshift(...items:number[] | Uint8Array[]):number {}

    //@ts-ignore
    values():IterableIterator<number> {}

    /**
     * Creates a generator function for iterating over a collection of uint8 arrays.
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
     * @param {number} [startIndex=0] - The zero-based offset from which to start iteration.
     * @param {number} [endIndex] - Optional parameter to specify where to end the iteration.
     * @param {0|1|2} [consistencyMode=0] - Determines the consistency mode of the iterator.
     *        Default is '0' for a consistent snapshot of all elements.

     * @returns {Generator<T, void, unknown>} - A generator that yields elements from the collection of uint8 arrays.
     */
    *[Symbol.iterator](startIndex:number=0, endIndex?:number, consistencyMode:0|1|2=0):Generator<number, void, unknown>
    {
        const arrays = this._arrays;
        const totalLength = this._length;

        if (startIndex < 0) startIndex = Math.max(0, totalLength + startIndex);
        if (endIndex !== undefined && endIndex < 0) endIndex = Math.max(0, totalLength + endIndex);

        const result:number[] = [];
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

    at(index:number):number | undefined
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

    #concat = (arrays:Uint8Array[]):Uint8Array =>
    {
        let totalLength = 0;
        for (const array of arrays) totalLength += array.length;

        const result = new Uint8Array(totalLength);
        let currentIndex = 0;
        for (const array of arrays) 
        {
            result.set(array, currentIndex);
            currentIndex += array.length;
        }

        return result;
    }
}
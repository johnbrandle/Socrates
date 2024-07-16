/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import type { IIdentifiable } from "../IIdentifiable";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { Entity } from "../entity/Entity";
import { IWeakSignal } from "../signal/IWeakSIgnal";
import { WeakSignal } from "../signal/WeakSignal";
import { ICollectionType, type ICollection } from "./ICollection";
import { SortedCollection } from "./SortedCollection";

enum BucketType
{
    Standard = 0,
    Nested = 1,
}

/**
 * Represents a bucket containing items and their sorting state.
 * @template T The type of items in the bucket.
 */
type StandardBucket<A extends IBaseApp<A>, T extends IIdentifiable> = {id:string, type:BucketType.Standard, set:SortedCollection<A, T>};

/**
 * Represents a nested bucket containing a SortedBucketArray of items.
 * @template T The type of items in the bucket.
 */
type NestedBucket<A extends IBaseApp<A>, T extends IIdentifiable> = {id:string, type:BucketType.Nested, set:SortedBucketCollection<A, T>};

/**
 * Represents a collection of buckets, each containing a segment of items that can be sorted independently. 
 * This class provides functionality for adding, removing, and retrieving items from buckets, where each 
 * bucket can be either a standard bucket or a nested SortedBucketArray itself.
 * 
 * The SortedBucket class manages the organization of items into buckets based on a bucket ID determined 
 * by a provided function. Each bucket maintains its own sorted state and can contain either a simple list of 
 * items or another SortedBucketArray (nested buckets). The class also handles the asynchronous sorting of 
 * these buckets, ensuring that operations such as adding or removing items do not block the main execution flow.
 * 
 * Key functionalities include:
 * - Adding items to the appropriate bucket based on their bucket ID.
 * - Removing items from their respective buckets.
 * - Retrieving items based on their index.
 * - Handling both standard and nested buckets, allowing for complex data organization.
 * - Asynchronously sorting buckets to maintain sorted order without hindering performance.
 * 
 * This class is particularly useful in scenarios where data needs to be categorized into different groups 
 * (buckets) and each group has to maintain a sorted order. The support for nested buckets adds a layer of 
 * depth to how data can be structured and accessed.
 *
 * @template T The type of elements stored in the SortedBucketArray.
 */
@ImplementsDecorator(ICollectionType)
export class SortedBucketCollection<A extends IBaseApp<A>, T extends IIdentifiable> extends Entity<A> implements ICollection<A, T>
{
    private _buckets:Map<string, StandardBucket<A, T> | NestedBucket<A, T>> = new Map();
    private _nestedBuckets:Set<NestedBucket<A, T>> = new Set();
    
    private _bucketByItem:Map<T, StandardBucket<A, T> | NestedBucket<A, T>> = new Map();

    private _length = 0;

    private _getBucketID:(item:T) => string;
    private _sort:(a:T, b:T) => number;

    private _reversed:boolean;
    public get reversed():boolean { return this._reversed; }

    private _onInvalidatedSignal:IWeakSignal<[ICollection<A, T>]> | undefined;
    public get onInvalidatedSignal() { return this._onInvalidatedSignal ?? (this._onInvalidatedSignal = new WeakSignal(this._app)); };

    /**
     * Initializes a new instance of the SortedBucketArray class. This constructor sets up the array with 
     * specified bucket IDs and initializes buckets as either standard or nested based on the provided input. 
     * It also takes an initial array of items and distributes them into the appropriate buckets.
     *
     * The constructor performs the following actions:
     * - Sets up the `getBucketID` and `sort` functions for later use in bucket management and item sorting.
     * - Iterates over the provided `bucketIDs` array to create and initialize buckets:
     *   - For each standard bucket ID (string), a standard bucket is created and added to the `_buckets` map.
     *   - For each nested bucket object (`{id, nested}`), a nested bucket is created with its own SortedBucketArray 
     *     and added to the `_buckets` map.
     * - Bulk inserts the initial array of items (`items`) into their respective buckets using the `getBucketID` function.
     *   Items are placed directly into the `items` array of the appropriate bucket or added to the nested SortedBucketArray.
     * - Schedules the initial sorting of buckets using `#scheduleSort`.
     * 
     * This constructor allows for the creation of a complex, multi-level bucketed data structure, capable of 
     * handling both standard and nested sorting scenarios. It ensures that the SortedBucketArray is correctly 
     * initialized and ready to manage and sort a diverse set of items.
     *
     * @param {Array<string | {id:string, nested:SortedBucketCollection<T>}>} bucketIDs - The IDs of the buckets or objects 
     *        representing nested buckets.
     * @param {(item: T) => string} getBucketID - A function that returns the bucket ID for an item.
     * @param {(a: T, b: T) => number} sort - A function used for comparing two items.
     * @param {T[]} items - Initial array of items to be added to the buckets.
     */
    constructor(app:A, bucketIDs:Array<string | {id:string, nested:SortedBucketCollection<A, T>}>, getBucketID:(item:T) => string, sort:(a:T, b:T) => number, items:T[], reversed:boolean=false)
    {
        super(app);

        this._getBucketID = getBucketID;
        this._sort = sort;
        this._reversed = reversed;

        this.#createBuckets(bucketIDs);
        
        this.addAll(items);
    }

    /**
     * Retrieves an item at a specified index from the entire collection of buckets. This method calculates
     * the cumulative index across all buckets to find the item corresponding to the given index. The process
     * involves iterating through each bucket and accounting for the number of items in each until the cumulative
     * count reaches or surpasses the specified index. Once the correct bucket and
     * relative index within that bucket are identified, the method returns the item at that index. If the index
     * is out of bounds (greater than the total number of items across all buckets), the method returns `undefined`.
     * 
     * This approach allows for efficient retrieval of items from a large collection that is divided into
     * independently sorted segments (buckets), enabling quick access while maintaining the overall sorted order.
     * 
     * @param {number} index - The zero-based index of the item to retrieve.
     * @returns {T | undefined} The item at the specified index, or undefined if the index is out of range.
     */
    public at(index:number):T | undefined
    {
        if (index < 0) return undefined;
        
        const buckets = this._buckets;
        
        let cumulativeLength = 0;
        for (const bucket of buckets.values())
        {
            const totalLength = cumulativeLength + bucket.set.size;
            if (index >= totalLength) 
            {
                cumulativeLength = totalLength;
                continue;
            }

            const localIndex = index - cumulativeLength;

            return bucket.set.at(localIndex);
        }

        return undefined;
    }

    /**
     * Returns the index of the specified item in the SortedBucketSet.
     * If the item is not found, returns -1.
     *
     * @param item - The item to search for.
     * @returns The index of the item, or -1 if not found.
     */
    public indexOf(item:T):number
    {
        const bucket = this._bucketByItem.get(item);
        if (bucket === undefined) return -1;

        return bucket.set.indexOf(item);
    }

    public get(id:string):T | undefined
    {
        for (const bucket of this._buckets.values())
        {
            const item = bucket.set.get(id);
            if (item !== undefined) return item;
        }

        return undefined;
    }
    
    /**
     * Creates an iterator for the SortedBucketArray, starting from a given offset.
     * This iterator allows traversing through all items in the collection, starting
     * from the specified offset, and optionally up to a specified end index, yielding one item at a time.
     *
     * The 'consistencyMode' option within the 'options' parameter determines the behavior of the iterator 
     * in relation to changes in the underlying data during iteration:
     * - Mode 0: Collects items first and yields them after completing the entire iteration, providing
     *   a consistent snapshot of the data at the start of iteration. This mode is memory-intensive as it stores
     *   all items before yielding, but it offers the highest level of consistency.
     * - Mode 1: Yields a copied slice of the items for each bucket, offering consistency within each bucket
     *   while not accumulating all items at once. This mode balances consistency and memory usage.
     * - Mode 2: Yields items directly from the bucket, reflecting real-time changes in the underlying data.
     *   This mode is the most memory-efficient but can yield inconsistent results if the underlying data changes 
     *   during iteration. Use this mode when immediate data reflection is more important than consistency,
     *   or when you're sure the data won't change during iteration. Do not use in awaited scenarios!
     *
     * @param {number} startIndex - The zero-based offset from which to start iteration.
     * @param {number} [endIndex] - Optional parameter to specify where to end the iteration.
     * @param {object} [options] - Optional configuration object.
     * @param {0|1|2} [options.consistencyMode=0] - Determines the consistency mode of the iterator.
     *        Default is '0' for a consistent snapshot of all items.
     * @param {boolean} [options.noSort=false] - Determines whether to skip sorting the buckets before iteration.
     * @returns {Generator<T, void, undefined>} - A generator that yields items from the SortedBucketArray.
     */
    public *[Symbol.iterator](startIndex:number=0, endIndex?:number, options?:{consistencyMode?:0|1|2, noSort?:boolean}):Generator<T, void, undefined> 
    {
        if (startIndex < 0) startIndex = Math.max(0, this.size + startIndex);
        if (endIndex !== undefined && endIndex < 0) endIndex = Math.max(0, this.size + endIndex);
        
        const consistencyMode = options?.consistencyMode ?? 0;
        const noSort = options?.noSort ?? false;

        const result:T[] = [];
        let resultIndex = 0;

        let culmulativeLength = 0; //initialize the current index to track the progress through the buckets.
        for (const bucket of this._buckets.values()) 
        {
            //calculate the total number of items in this bucket, including both sorted and pending items.
            const totalLength = culmulativeLength + bucket.set.size;

            //check if the current index plus the total items in the bucket is still less than or equal to the offset.
            //if so, skip this bucket as it doesn't contain the offset item, and continue to the next bucket.
            if (startIndex >= totalLength)
            {
                culmulativeLength = totalLength;
                continue;
            }

            const bucketSet = bucket.set;

            //calculate the starting index for this bucket, taking into account the offset and current index.
            const localStartIndex = Math.max(0, startIndex - culmulativeLength);
            const localEndIndex = endIndex !== undefined ? Math.min(endIndex - culmulativeLength, bucketSet.size) : bucketSet.size;

            if (bucket.type === BucketType.Nested) 
            {
                switch (consistencyMode)
                {
                    case 0:
                        for (const item of bucket.set[Symbol.iterator](localStartIndex, localEndIndex, {consistencyMode:2, noSort:noSort})) result[resultIndex++] = item;
                        break;
                    case 1:
                    case 2:
                        for (const item of bucket.set[Symbol.iterator](localStartIndex, localEndIndex, options)) yield item;
                        break;
                }
            }
            else
            {
                switch (consistencyMode)
                {
                    case 0:
                        for (const item of bucketSet[Symbol.iterator](localStartIndex, localEndIndex, {consistencyMode:1, noSort:noSort})) result[resultIndex++] = item; //use consistency mode 1 since we are collecting all items before yielding   
                        break;
                    case 1:
                        for (const item of bucketSet[Symbol.iterator](localStartIndex, localEndIndex, {consistencyMode:0, noSort:noSort})) yield item; //use consistency mode 0, which will be the equivalent of consistency mode 1
                        break;
                    case 2:
                        for (const item of bucketSet[Symbol.iterator](localStartIndex, localEndIndex, {consistencyMode:1, noSort:noSort})) yield item; //use consistency mode 1 to match consistency mode 2 option
                        break;
                }
            }

            //update the current index to account for the items in this bucket.
            culmulativeLength = totalLength;
        }

        if (consistencyMode === 0) for (const item of result) yield item; //yield each item from the result array.
    }

    /**
     * An iterator function that returns the values of the SortedBucketSet. (alias for `SortedBucketSet[Symbol.iterator]`)
     */
    public values = this[Symbol.iterator];

    /**
     * Adds a single item to the appropriate bucket in the SortedBucketArray. This method determines the bucket ID 
     * for the item using the `getBucketID` function and then adds the item to the identified bucket. The process 
     * varies depending on whether the bucket is a standard or nested bucket and its current sorting state.
     *
     * This method ensures efficient addition of items while maintaining the sorted state and integrity of the buckets, 
     * accommodating both standard and nested structures. It keeps the SortedBucketArray consistent and up-to-date with 
     * all added items.
     *
     * @param {T} item - The item to be added.
     * @throws {Error} If the bucket corresponding to the item does not exist.
     */
    public add(item:T):void
    {
        const id = this._getBucketID(item);
        const bucket = this._buckets.get(id);

        if (bucket === undefined) throw new Error(`Bucket with ID ${id} does not exist.`);

        bucket.set.add(item);
        this._bucketByItem.set(item, bucket);

        if (bucket.type === BucketType.Nested)
        {
            this.onInvalidatedSignal.dispatch(this);
            return;
        }

        this._length++; //update the length

        this.onInvalidatedSignal.dispatch(this);
    }

    /**
     * Adds multiple items to their respective buckets in the SortedBucketArray. This method iterates through 
     * each item in the provided array and determines the appropriate bucket for each item using the `getBucketID` function.
     * Depending on the bucket type (standard or nested) and its current state, the method then adds the items to the 
     * appropriate part of the bucket.
     *
     * This method efficiently adds items while maintaining the sorted state and integrity of each bucket, accommodating 
     * both standard and nested bucket structures. It ensures that the SortedBucketArray accurately reflects all added items.
     *
     * @param {T[]} items - The array of items to be added.
     * @throws {Error} If the bucket corresponding to an item does not exist.
     */
    public addAll(items:T[]):void 
    {
        const buckets = this._buckets;
        const getBucketID = this._getBucketID;
        const bucketByItem = this._bucketByItem;

        const itemsToAdd:Map<StandardBucket<A, T> | NestedBucket<A, T>, T[]> = new Map();
          
        //collect the items to add to each bucket
        for (const item of items)
        {
            const id = getBucketID(item);

            const bucket = buckets.get(id);
            if (bucket === undefined) throw new Error(`Bucket with ID ${id} does not exist.`);
            
            const addArray = itemsToAdd.get(bucket) ?? itemsToAdd.set(bucket, []).get(bucket)!;

            bucketByItem.set(item, bucket);
            addArray.push(item);
        }
  
        //loop through the buckets, add the items, any buckets with more than 1 items should be added to the bucketsPendingSort set
        let length = this._length;
        for (const [bucket, addItems] of itemsToAdd.entries()) 
        {
            bucket.set.addAll(addItems);
              
            if (bucket.type === BucketType.Nested) continue;
  
            length += addItems.length;
        }
        this._length = length;
  
        this.onInvalidatedSignal.dispatch(this);
    }

    /**
     * Removes a specified item from its corresponding bucket within the SortedBucketArray. This method handles 
     * both standard and nested buckets, ensuring that the item is removed correctly regardless of its location 
     * in the hierarchical structure. The method first identifies the appropriate bucket based on the item's bucket 
     * ID (determined by the `_getBucketID` function) and then proceeds according to the bucket type and state.
     *
     * After the removal, the total length of the SortedBucketArray is updated. This method ensures that the 
     * removal of an item does not disrupt the sorted order of the buckets and maintains the integrity of the 
     * data structure.
     *
     * @param {T} item - The item to be removed.
     * @throws {Error} If the item does not exist in its respective bucket.
     * @throws {Error} If the bucket corresponding to the item does not exist.
     */
    public delete(item:T):boolean
    {
        //retrieve the bucket based on the item's bucket ID
        const id = this._getBucketID(item);
        const bucket = this._buckets.get(id);
    
        //if the bucket does not exist, throw an error
        if (bucket === undefined) throw new Error(`Bucket with ID ${id} does not exist.`);

        const success = bucket.set.delete(item);
        if (success === false) return success;

        this._bucketByItem.delete(item);

        if (bucket.type === BucketType.Standard) this._length--;

        this.onInvalidatedSignal.dispatch(this);

        return success;
    }

    public deleteAll(items:T[]):number
    {
        const buckets = this._buckets;
        const getBucketID = this._getBucketID;
        const bucketByItem = this._bucketByItem;

        const itemsToDelete:Map<StandardBucket<A, T> | NestedBucket<A, T>, T[]> = new Map();
          
        for (const item of items)
        {
            const id = getBucketID(item);

            const bucket = buckets.get(id);
            if (bucket === undefined) throw new Error(`Bucket with ID ${id} does not exist.`);
            
            const deleteArray = itemsToDelete.get(bucket) ?? itemsToDelete.set(bucket, []).get(bucket)!;

            bucketByItem.delete(item);
            deleteArray.push(item);
        }
  
        let length = this._length;
        let deleted = 0;
        for (const [bucket, deleteItems] of itemsToDelete.entries()) 
        {
            const count = bucket.set.deleteAll(deleteItems);
            deleted += count;
            
            if (bucket.type === BucketType.Nested) continue;

            length -= count;
        }
        this._length = length;

        if (deleted !== 0) this.onInvalidatedSignal.dispatch(this);

        return deleted;
    }

    /**
     * Calculates and returns the total number of items in all buckets, including both standard and nested buckets. 
     * This method provides an accurate count of all items managed by the SortedBucketArray instance, accounting 
     * for the hierarchical structure introduced by nested buckets.
     *
     * The method performs the following actions:
     * - Initializes a variable `length` with the base length of the array (`_length`), which represents the total 
     *   number of items in all standard buckets.
     * - If there are nested buckets (`_nestedBuckets`), it iterates over each nested bucket and adds its length to 
     *   the total. The length of each nested bucket is reduced by one to account for the nested bucket itself being 
     *   counted as an item in its parent bucket.
     * - Returns the total length, which now includes the count of items in both standard and nested buckets.
     *
     * This approach ensures that the length property always reflects the current state of the SortedBucketArray, 
     * providing a reliable count of all items, irrespective of how they are organized within the nested structure.
     *
     * @returns {number} The total number of items in the SortedBucketArray, including items in nested buckets.
     */
    public get size():number 
    {
        const nestedBuckets = this._nestedBuckets;

        if (nestedBuckets.size === 0) return this._length; //if there are no nested buckets, return the length
        
        let length = this._length;
        for (const bucket of nestedBuckets.values()) length += bucket.set.size; //don't subtract one because this._length does not include the nested buckets themselves

        return length;
    }

    /**
     * Returns a new array containing a portion of the elements in the SortedBucketSet.
     * @param startIndex - The index at which to begin the slicing. Default is 0.
     * @param endIndex - The index at which to end the slicing (exclusive).
     *                   If not provided, slicing will continue until the end of the SortedBucketSet.
     * @returns A new array containing the sliced elements.
     */
    public slice(startIndex:number=0, endIndex?:number):T[]
    {
        if (startIndex < 0) startIndex = Math.max(0, this.size + startIndex);
        if (endIndex !== undefined && endIndex < 0) endIndex = Math.max(0, this.size + endIndex);

        const result:T[] = [];
        for (const item of this[Symbol.iterator](startIndex, endIndex, {consistencyMode:2})) result.push(item);

        return result;
    }

    /**
     * Invalidates the SortedBucketSet by optionally specifying specific bucket IDs to invalidate.
     * If no bucket IDs are provided, all buckets will be invalidated.
     * Optionally, a custom sorting function, item-to-bucket mapping function, and reversed flag can be provided.
     * If items are provided, the SortedBucketSet will be cleared and the new items will be added.
     * 
     * @param bucketIDs - An optional array of bucket IDs or nested bucket objects to invalidate.
     * @param getBucketID - An optional function to map items to bucket IDs.
     * @param sort - An optional sorting function for the buckets.
     * @param items - An optional array of items to add to the SortedBucketSet after invalidation.
     * @param reversed - An optional flag indicating whether to reversed the sorting order.
     */
    public invalidate(item:T):boolean;
    public invalidate(bucketIDs:Array<string | {id:string, nested:SortedBucketCollection<A, T>}>, getBucketID:(item:T) => string, sort:(a:T, b:T) => number, items?:T[], reversed?:boolean):void;
    public invalidate(...args:Array<any>)
    {
        if (args.length > 1)
        {
            let [bucketIDs, getBucketID, sort, items, reversed] = args;

            this._sort = sort;
            this._getBucketID = getBucketID;
            this._reversed = reversed ?? this._reversed;

            const buckets = this._buckets;
            const nestedBuckets = this._nestedBuckets;
        
            if (items === undefined) //if no items are provided, collect all items from the buckets
            {
                items = [];
                let i = 0;
                for (const item of this.values(0, undefined, {consistencyMode:2, noSort:true})) items[i++] = item;
            }
            
            this.clear();  
            
            buckets.clear();
            nestedBuckets.clear();

            this.#createBuckets(bucketIDs);
            
            this.addAll(items); //this will call onChangedSignal.dispatch(this) for us
            return;
        }

        const buckets = this._buckets;
        const item = args[0];
        const bucketID = this._getBucketID(item);

        let bucket = this._bucketByItem.get(item);
        if (bucket === undefined) throw new Error(`Bucket with ID ${bucketID} does not exist.`);

        //if the item is going to be in the same set/bucket after invalidation, invalidate the set/bucket
        if (bucket.id === bucketID) 
        {
            const success = bucket.set.invalidate(item);

            if (success === false) return success;

            this.onInvalidatedSignal.dispatch(this);
            return success;
        }
        //item will be in a different bucket, so we need to remove it from it's current bucket, and add it to the new one
        bucket.set.__delete(item);
        
        bucket = buckets.get(bucketID);
        if (bucket === undefined) throw new Error(`Bucket with ID ${bucketID} does not exist.`);

        bucket.set.add(item);
        this._bucketByItem.set(item, bucket);

        this.onInvalidatedSignal.dispatch(this);

        return true;
    }

    /**
     * Reverses the order of the elements in the SortedBucketSet.
     */
    public reverse():void
    {
        this._reversed = !this._reversed;

        this.#reverse();

        this.onInvalidatedSignal.dispatch(this);
    }

    #reverse():void
    {
        const buckets = this._buckets;
        const bucketArray:Array<StandardBucket<A, T> | NestedBucket<A, T>> = [];
        for (const bucket of buckets.values()) 
        {
            if (bucket.type === BucketType.Standard) bucket.set.reverse();
            else bucket.set.reverse();

            bucketArray.push(bucket);
        }

        buckets.clear();
        for (let i = bucketArray.length; i--;) buckets.set(bucketArray[i].id, bucketArray[i]);
    }

    /**
     * Clears the SortedBucketSet by resetting the length and clearing all buckets.
     * If a bucket is of type Standard, its set is cleared. If a bucket is of type Nested, its nested SortedBucketSet is cleared.
     * Also clears the pending sort buckets and cancels any scheduled sort timeout.
     */
    public clear():void
    {
        this._length = 0;
        this._bucketByItem.clear();
        for (const bucket of this._buckets.values()) 
        {
            if (bucket.type === BucketType.Standard) bucket.set.clear();
            else bucket.set.clear(); 
        }

        this.onInvalidatedSignal.dispatch(this);
    }

    public __delete(item:T):boolean
    {
        const bucket = this._bucketByItem.get(item);
    
        //if the bucket does not exist, throw an error
        if (bucket === undefined) throw new Error(`Bucket does not exist.`);

        const success = bucket.set.__delete(item);
        if (success === false) return success;

        this._bucketByItem.delete(item);

        if (bucket.type === BucketType.Standard) this._length--;

        return success;
    }

    /**
     * Creates buckets based on the provided bucket IDs.
     * If a bucket ID is a string, a standard bucket is created with an empty SortedSet.
     * If a bucket ID is an object with an 'id' and 'nested' property, a nested bucket is created with the provided nested SortedBucketSet.
     * @param bucketIDs - An array of bucket IDs, which can be either strings or objects.
     */
    #createBuckets(bucketIDs:Array<string | {id:string, nested:SortedBucketCollection<A, T>}>)
    {
        const buckets = this._buckets;
        const nestedBuckets = this._nestedBuckets;
        const sort = this._sort;
        const reversed = this._reversed;

        for (let i = 0, length = bucketIDs.length; i < length; i++) 
        {
            const bucketID = bucketIDs[i];

            if (typeof bucketID === 'string') buckets.set(bucketID, {id:bucketID, type:BucketType.Standard, set:new SortedCollection(this._app, sort)});
            else 
            {
                const bucket:NestedBucket<A, T> = {id:bucketID.id, type:BucketType.Nested, set:bucketID.nested};

                buckets.set(bucketID.id, bucket);

                nestedBuckets.add(bucket);
            }
        }

        if (reversed === true) this.#reverse();
    }
}
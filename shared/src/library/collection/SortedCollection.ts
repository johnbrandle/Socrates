/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IIdentifiable } from "../IIdentifiable";
import { ICollectionType, type ICollection } from "./ICollection";
import { MultipartArray } from "../multipart/MultipartArray";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IBaseApp } from "../IBaseApp";
import { Entity } from "../entity/Entity";
import { WeakSignal } from "../signal/WeakSignal";
import { IWeakSignal } from "../signal/IWeakSIgnal";

/**
 * Represents a state of sorting.
 * @enum {number}
 */
export enum SortedState
{
    NOT_SORTED = 0,
    PARTIALLY_SORTED = 1,
    SORTED = 2
}

/**
 * Represents a sorted set of items, providing efficient addition, deletion, and retrieval operations.
 * The set maintains its elements in sorted order, as determined by the provided sorting function.
 * Sorting is performed lazily, optimizing performance by reducing unnecessary sorts.
 * 
 * @template T The type of elements in the sorted set.
 */
@ImplementsDecorator(ICollectionType)
export class SortedCollection<A extends IBaseApp<A>, T extends IIdentifiable> extends Entity<A> implements ICollection<A, T>
{
    /**
     * The main array storing the sorted items.
     * @type {T[]}
     * @private
     */
    private _items:T[] = [];

    /**
     * Array storing items pending to be sorted and merged into the main array.
     * @type {T[]}
     * @private
     */
    private _pending:T[] = [];

    /**
     * Represents the current sorting state of the set.
     * @type {SortedState}
     * @private
     */
    private _state:SortedState = SortedState.NOT_SORTED;

    /**
     * The sorting function used to order elements in the set.
     * @type {(a:T, b:T) => number}
     * @private
     */
    private _sort:(a:T, b:T) => number;

    /**
     * Map storing items by ID.
     * @type {Map<string, T>}
     * @private
     */
    private _itemsByID:Map<string, T> = new Map();

    /**
     * Whether the order of the sorted set is reversed.
     * @type {boolean}
     * @private
     */
    private _reversed:boolean;
    public get reversed():boolean { return this._reversed; }

    private _onInvalidatedSignal:IWeakSignal<[ICollection<A, T>]> | undefined;
    public get onInvalidatedSignal() { return this._onInvalidatedSignal ?? (this._onInvalidatedSignal = new WeakSignal(this._app)); };

    /**
     * Constructs a new SortedSet instance.
     * 
     * @param {(a:T, b:T) => number} sort The sorting function to determine the order of elements.
     * @param {T[]} items Initial set of items to include in the sorted set.
     * @param {boolean} reversed Whether set should be in reverse order.
     */
    constructor(app:A, sort:(a:T, b:T) => number, items?:T[], reversed:boolean=false)
    {
        super(app);

        this._sort = sort;
        this._items = items ?? [];
        this._reversed = reversed;

        const itemsByID = this._itemsByID;
        for (const item of this._items) itemsByID.set(item.id, item); //TODO, it would be better to do this lazily, as items may never need to be retrieved by ID
    }

    /**
     * Retrieves an item at a specific index in the sorted set. If the set is not sorted, it triggers a sort operation.
     * 
     * @param {number} index The index of the item to retrieve.
     * @returns {T | undefined} The item at the specified index, or undefined if the index is out of bounds.
     */
    public at(index:number):T | undefined
    {
        if (index < 0) return undefined;
        
        if (this._state !== SortedState.SORTED) this.sort();

        return this._items[index];
    }

    /**
     * Retrieves an item from the SortedSet by its ID.
     * @param id The ID of the item to retrieve.
     * @returns The item with the specified ID, or undefined if it does not exist.
     */
    public get(id:string):T | undefined
    {
        return this._itemsByID.get(id);
    }

    /**
     * Returns the index of the specified item in the sorted set.
     * If the item is not found, returns -1.
     * 
     * @param item - The item to search for.
     * @returns The index of the item, or -1 if not found.
     */
    public indexOf(item:T):number
    {
        if (this._state !== SortedState.SORTED) this.sort();

        const items = this._items;
        const sort = this._sort;
        const reversed = this._reversed;

        let minIndex = 0;
        let maxIndex = items.length - 1;
        let currentItem:T;

        //binary search to find the item's potential location
        while (minIndex <= maxIndex) 
        {
            const currentIndex = Math.floor((minIndex + maxIndex) / 2);
            currentItem = items[currentIndex];
    
            const order = sort(item, currentItem) * (reversed === true ? -1 : 1);
            if (order > 0) minIndex = currentIndex + 1;
            else if (order < 0) maxIndex = currentIndex - 1;
            else minIndex = currentIndex + 1; //continue searching right to find last equal item
        }
    
        //iterate backwards to find the exact item
        for (let i = minIndex - 1; i >= 0; i--)
        {
            currentItem = items[i];
    
            //check for exact match
            if (currentItem === item) return i;
            
            //if the current item's order is not equal, stop the iteration
            if (sort(item, currentItem) !== 0) break;
        }

        return -1;
    }

    /**
     * Checks if the SortedSet contains the specified item.
     * 
     * @param item - The item to check for.
     * @returns True if the item is found in the SortedSet, false otherwise.
     */
    public has(item:T):boolean
    {
        return this.indexOf(item) !== -1;
    }
    
    /**
     * Creates an iterator for the sorted set, allowing it to be used in for...of loops and other iterable contexts.
     * Supports optional start and end indices and a consistency mode for iteration.
     * 
     * The consistency mode determines the behavior of the iterator in relation to the state of the sorted set:
     * - Mode 0: "Snapshot Consistency". The iterator first creates a snapshot of the current items in the sorted set
     *   and then iterates over this snapshot. This ensures that the iteration reflects the state of the set at the
     *   beginning of the iteration, regardless of any subsequent changes to the set (e.g., additions, deletions).
     *   This mode is useful when a consistent view of the set is required throughout the iteration.
     * 
     * - Mode 1: "Real-time Consistency". The iterator directly iterates over the items of the set without creating a snapshot.
     *   This means that the iteration reflects real-time changes to the set. If items are added or removed during iteration,
     *   those changes could be reflected in the items that are iterated over. This mode is more memory-efficient and
     *   can be suitable for scenarios where immediate reflection of changes is more important than consistency.
     * 
     * @param {number} [startIndex=0] The starting index for the iteration.
     * @param {number} [endIndex] Optional ending index for the iteration.
     * @param {{consistencyMode?:0 | 1}} [options] Optional settings for iteration consistency.
     * @param {0 | 1} [options.consistencyMode=0] The consistency mode for the iteration.
     * @param {boolean} [options.noSort=false] Whether to skip sorting the set if it is not already sorted.
     * @returns {Generator<T, void, undefined>} A generator yielding elements of the set.
     */
    public *[Symbol.iterator](startIndex:number=0, endIndex?:number, options?:{consistencyMode?:0|1, noSort?:boolean}):Generator<T, void, undefined> 
    {
        const noSort = options?.noSort ?? false;

        if (this._state !== SortedState.SORTED && noSort === false) this.sort();

        const items = this._items;
        const pending = this._pending; //will only have a length if noSort is true and the set is not already sorted
        const totalLength = items.length + pending.length;

        endIndex = endIndex ?? totalLength;

        if (startIndex < 0) startIndex = Math.max(0, totalLength + startIndex);
        if (endIndex < 0) endIndex = Math.max(0, totalLength + endIndex);
        
        const consistencyMode = options?.consistencyMode ?? 0;

        const result:T[] = [];
        let resultIndex = 0;

        if (noSort === true && pending.length > 0)
        {
            for (const item of MultipartArray.values([items, pending], totalLength, startIndex, endIndex, 1))
            {
                switch (consistencyMode)
                {
                    case 0:
                        result[resultIndex++] = item; //copy the items into the result array.
                        break;
                    case 1:
                        yield item; //yield each item immediately.
                        break;
                }
            }
        }
        else
        {
            for (let i = startIndex; i < endIndex; i++)
            {
                switch (consistencyMode)
                {
                    case 0:
                        result[resultIndex++] = items[i]; //copy the items into the result array.
                        break;
                    case 1:
                        yield items[i]; //yield each item immediately.
                        break;
                }
            }
        }

        if (consistencyMode === 0) for (const item of result) yield item; //yield each item from the result array.
    }

    /**
     * Returns an iterator that iterates over the values in the SortedSet. (alias for [Symbol.iterator])
     */
    public values = this[Symbol.iterator];

    /**
     * Adds a new item to the sorted set. If the set is already sorted, the item is added to the pending array for later sorting.
     * 
     * @param {T} item The item to add to the set.
     */
    public add(item:T):void
    {
        this._itemsByID.set(item.id, item);

        if (this._state === SortedState.NOT_SORTED)
        {
            this._items.push(item);

            if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
            return;
        }

        this._state = SortedState.PARTIALLY_SORTED;
        this._pending.push(item);

        if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
    }

    /**
     * Adds multiple items to the sorted set.
     * 
     * @param items - An array of items to add to the sorted set.
     * @returns void
     */
    public addAll(items:T[]):void
    {
        const itemsByID = this._itemsByID;
        for (const item of items) itemsByID.set(item.id, item);

        if (this._state === SortedState.NOT_SORTED)
        {
            this._items.push(...items);

            if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
            return;
        }

        this._state = SortedState.PARTIALLY_SORTED;
        this._pending.push(...items);

        if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
    }

    /**
     * Deletes an item from the sorted set. If the set is not sorted, it triggers a sort operation.
     * 
     * @param {T} item The item to remove from the set.
     */
    public delete(item:T):boolean
    {
        if (this._state === SortedState.NOT_SORTED) this.sort();
        else if (this._state === SortedState.PARTIALLY_SORTED)
        {
            const pending = this._pending;
            
            //iterate over pending items in reverse
            for (let i = pending.length; i--;) 
            {
                const pendingItem = pending[i];
                
                //check for exact match with the item
                if (pendingItem !== item) continue;

                //remove the item and update state and length
                pending.splice(i, 1);

                this._itemsByID.delete(item.id);
                
                if (pending.length === 0) this._state = SortedState.SORTED; //state was partially sorted, but now it's sorted

                if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
                return true;
            }
        }

        const items = this._items;
        const pending = this._pending;

        if (items.length === 1)
        {
            if (items[0] !== item) return false;
            
            this._itemsByID.delete(item.id);

            items.length = 0;
            if (pending.length === 0) this._state = SortedState.SORTED;

            if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
            return true;
        }
    
        //initialize variables for binary search in the sorted items array
        let minIndex = 0;
        let maxIndex = items.length - 1;
        let currentIndex:number;
        let currentItem:T;

        const sort = this._sort;
        const reversed = this._reversed;
    
        //binary search to find the item's potential location
        while (minIndex <= maxIndex) 
        {
            currentIndex = Math.floor((minIndex + maxIndex) / 2);
            currentItem = items[currentIndex];
    
            const order = sort(item, currentItem) * (reversed === true ? -1 : 1);
            if (order > 0) minIndex = currentIndex + 1;
            else if (order < 0) maxIndex = currentIndex - 1;
            else minIndex = currentIndex + 1; //continue searching right to find last equal item
        }
    
        //iterate backwards to find the exact item to remove
        for (let i = minIndex - 1; i >= 0; i--)
        {
            currentItem = items[i];
    
            //check for exact match
            if (currentItem === item)
            {
                //remove the item and update length
                items.splice(i, 1);

                this._itemsByID.delete(item.id);

                if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
                return true;
            }
    
            //if the current item's order is not equal, stop the iteration
            if (sort(item, currentItem) !== 0) break;
        }
    
        return false;
    }

    public deleteAll(items:T[]):number
    {
        if (this._state !== SortedState.SORTED) this.sort();

        const itemsByID = this._itemsByID;
        
        let deleted = 0;
        const invalidatedSignal = this._onInvalidatedSignal;
        this._onInvalidatedSignal = undefined; //prevent the signal from being dispatched for each item
        for (const item of items) 
        {
            const success = this.delete(item);
            if (success === true) deleted++;

            itemsByID.delete(item.id);
        }
        this._onInvalidatedSignal = invalidatedSignal;

        if (this._onInvalidatedSignal !== undefined && deleted !== 0) this._onInvalidatedSignal.dispatch(this);
        return deleted;
    }

    /**
     * Gets the total number of items in the sorted set, including pending items.
     * 
     * @returns {number} The total number of items in the set.
     */
    public get size():number 
    {
        return this._items.length + this._pending.length;
    }

    /**
     * Gets the state of the SortedSet.
     * @returns The SortedState of the SortedSet.
     */
    public get state():SortedState { return this._state; }
    
    /**
     * Triggers the sorting of the set. It sorts the main items array if not sorted,
     * and merges any pending items into the sorted array.
     * 
     * @private
     * 
     * @returns {number} The number of items that were sorted. (not necessarily equal to the total number of items in the set)
     */
    public sort():number
    {
        const sort = this._sort;
        const items = this._items;
        const pending = this._pending;
        const reversed = this._reversed;

        if (this._state === SortedState.SORTED) return 0;
        if (this._state === SortedState.NOT_SORTED)
        {
            this._state = SortedState.SORTED;
            if (items.length <= 1) return items.length;

            items.sort(sort);
            if (reversed === true) items.reverse();
            return items.length;
        }

        /**
         * Determines the correct index to insert a given item into a sorted array. This method performs a binary search 
         * to find the position where the item should be inserted in the array to maintain the sorted order. It's used 
         * primarily in the context of merging sorted and pending items within a bucket.
         *
         * The method works as follows:
         * - Performs a binary search on the sorted array (`items`). The search compares the `item` with elements in the array 
         *   using the provided sorting function `_sort`.
         * - If `item` is greater than the current element in the search, the search continues in the right half of the array; 
         *   if smaller, in the left half.
         * - The method returns the index where the `item` should be inserted. This index is the point at which all elements 
         *   to the left are less than or equal to `item`, and all elements to the right are greater.
         *
         * @param {T} item - The item to be inserted.
         * @param {T[]} items - The sorted array of items into which the item is to be inserted.
         * @returns {number} The index at which the item should be inserted.
         */
        const getItemInsertIndex = (item:T, items:T[]):number =>
        {
            let minIndex = 0;
            let maxIndex = items.length - 1;
        
            while (minIndex <= maxIndex) 
            {
                const currentIndex = Math.floor((minIndex + maxIndex) / 2);
                const currentItem = items[currentIndex];
        
                const order = sort(item, currentItem) * (reversed === true ? -1 : 1); //compare the item with the current item in the array
                
                if (order > 0) minIndex = currentIndex + 1; //item is greater, search right
                else if (order < 0) maxIndex = currentIndex - 1; //item is smaller, search left
                else minIndex = currentIndex + 1; //items are equal, continue searching right to find last equal item
            }

            return minIndex;
        }

        /**
         * Merges two arrays (`items` and `pending`) into a single sorted array. This method is used to combine the 
         * already sorted items with the newly sorted pending items within a bucket, ensuring the overall sorted order 
         * is maintained. The method leverages pre-calculated insertion indexes for pending items to efficiently merge 
         * them into the sorted array.
         *
         * The merge process is as follows:
         * - Creates a new array `combined` to hold the merged result.
         * - Iterates over the `items` array, and at each iteration, inserts any pending items that should be positioned 
         *   at the current index, based on the `insertIndexes`.
         * - Continues to insert the remaining items from the `items` array and any remaining pending items after the 
         *   iteration.
         * - Returns the merged and sorted `combined` array.
         *
         * @param {T[]} items - The sorted array of items.
         * @param {T[]} pending - The sorted array of pending items to be merged.
         * @param {Uint32Array} insertIndexes - An array of insertion indexes indicating where each pending item should be inserted.
         * @returns {T[]} The merged and sorted array containing both items and pending items.
         */
        const combine = (items:T[], pending:T[], insertIndexes:Uint32Array):T[] => 
        {
            const combined:T[] = [];
            let pendingIndex = 0;
            let combinedIndex = 0;
        
            //iterate over items and insert pending items at appropriate positions
            for (let i = 0, length = items.length; i < length; i++) 
            {
                //insert pending items at their respective positions
                while (pendingIndex < pending.length && i === insertIndexes[pendingIndex]) combined[combinedIndex++] = pending[pendingIndex++];
                
                combined[combinedIndex++] = items[i];
            }
        
            //add remaining pending items if any
            while (pendingIndex < pending.length) combined[combinedIndex++] = pending[pendingIndex++];
            
            return combined;
        }

        if (pending.length === 0) throw new Error(`no pending items to sort.`);
        if (pending.length > 1) 
        {
            pending.sort(sort); //sort the pending items first
            if (reversed === true) pending.reverse();
        }

        this._state = SortedState.SORTED;

        if (items.length === 0)
        {
            this._items = pending;
            this._pending = [];
            
            return this._items.length; //there were no items, and we already sorted and transferred the pending items, so we're done
        }

        const insertIndexes = new Uint32Array(pending.length);
        for (let i = pending.length; i--;) insertIndexes[i] = getItemInsertIndex(pending[i], items);

        if (insertIndexes.length === 1)
        {
            items.splice(insertIndexes[0], 0, pending[0]);
            this._pending.length = 0;
            
            return 1;
        }

        this._items = combine(items, pending, insertIndexes);
        this._pending.length = 0;

        return insertIndexes.length;
    }

    /**
     * Invalidates the SortedSet by updating the sorting and reversing options, and removing the specified item if it exists.
     * If called with two arguments, the first argument represents the sorting option and the second argument represents the reversing option.
     * If called with one argument, it represents the item to be resorted. Note: it's very important to call this if the item's sort value changes.
     * @param args - The arguments for invalidation. Can be either [sort, reverse] or [item].
     */
    public invalidate(item:T):boolean;
    public invalidate(sort:(a:T, b:T) => number, reversed:boolean):void;
    public invalidate(...args:any[])
    {
        if (args.length === 2)
        {
            const [sort, reversed] = args;

            if (sort !== undefined) this._sort = sort;
            if (reversed !== undefined) this._reversed = reversed;

            if (this._state === SortedState.NOT_SORTED) return;
            this._state = SortedState.NOT_SORTED;

            if (this._pending.length === 0) return;

            this._items.push(...this._pending);
            this._pending.length = 0;

            if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
            return;
        }

        const [item] = args;
        
        //we can't call this.delete because this.delete expects the item to be in its proper sorted position. calling invalidate means
        //the item may no longer be in its proper sorted position, so we have to call __delete instead, which does not expect the item to be sorted.
        //note: we don't need to worry about updating this._itemsByID because ids should be immutable
        const success = this.__delete(item);
        if (success === false) return false;

        this.add(item); //invalidate signal will be called in add

        return true;
    }

    /**
     * Reverses the order of the items in the sorted set.
     */
    public reverse()
    {
        this._reversed = !this._reversed;

        if (this._state === SortedState.NOT_SORTED) return;
        
        this._items.reverse();

        if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
    }

    /**
     * Clears the SortedSet by removing all items and resetting the sorting state.
     */
    public clear()
    {
        this._items.length = 0;
        this._pending.length = 0;
        this._state = SortedState.NOT_SORTED;
        this._itemsByID.clear();

        if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
    }

    /**
     * Deletes an item from the SortedSet.
     * 
     * @param item - The item to delete.
     * @returns True if the item was found and deleted, false otherwise.
     */
    public __delete(item:T):boolean
    {
        const items = this._items;
        const pending = this._pending;

        let index = items.indexOf(item);
        if (index !== -1) 
        {
            items.splice(index, 1);
            this._itemsByID.delete(item.id);
            if (items.length < 2 && pending.length === 0) this._state = SortedState.SORTED;
            return true;
        }

        index = pending.indexOf(item);
        if (index !== -1) 
        {
            pending.splice(index, 1);
            this._itemsByID.delete(item.id);
            if (items.length < 2 && pending.length === 0) this._state = SortedState.SORTED;
            return true;
        }

        return false;
    }
}
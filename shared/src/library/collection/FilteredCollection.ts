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

/**
 * Represents a filtered set that implements the IBaseSet interface.
 * The FilteredSet allows filtering the elements based on a provided filter function.
 * @template T The type of elements in the set.
 */
@ImplementsDecorator(ICollectionType)
export class FilteredCollection<A extends IBaseApp<A>, S extends ICollection<A, T>, T extends IIdentifiable = S extends ICollection<A, infer U> ? U : never> extends Entity<A> implements ICollection<A, T>
{
    /**
     * The underlying set for the FilteredSet class.
     */
    private _set:S;
    public get set():S { return this._set; }

    /**
     * A function used to filter elements in the set.
     * @param a The element to be filtered.
     * @returns True if the element should be included in the set, false otherwise.
     */
    private _filter?:(a:T) => boolean;
    public set filter(filter:((a:T) => boolean) | undefined) 
    {
        this._cache = undefined; 
        this._filter = filter; 

        this._onInvalidatedSignal?.dispatch(this);
    }

    /**
     * The signal that is emitted when the set is invalidated.
     * @private
     */
    private _onInvalidatedSignal:IWeakSignal<[ICollection<A, T>]> | undefined;
    public get onInvalidatedSignal() { return this._onInvalidatedSignal ?? (this._onInvalidatedSignal = new WeakSignal(this._app)); };

    /**
     * The cache for storing filtered elements.
     */
    private _cache?:Array<T>;

    /**
     * Creates a new FilteredSet instance.
     * @param set The base set to filter.
     * @param filter The filter function to apply to the elements of the set.
     */
    constructor(app:A, set:S, filter?:(a:T) => boolean)
    {
        super(app);

        this._set = set;
        set.onInvalidatedSignal.subscribe(this, this.onInvalidated);

        this._filter = filter;
    }

    private onInvalidated = () =>
    {
        this._cache = undefined;
        this._onInvalidatedSignal?.dispatch(this);
    }

    /**
     * Returns the number of elements in the FilteredSet.
     * If a filter function is applied, it returns the number of elements that pass the filter.
     * @returns The number of elements in the FilteredSet.
     */
    public get size():number
    {
        if (this._filter === undefined) return this._set.size;
        if (this._cache !== undefined) return this._cache.length;

        const cache = [];
        for (const value of this._set.values(0, undefined, {consistencyMode:1}))
        {
            if (this._filter(value) !== true) continue;
            
            cache.push(value);
        }

        this._cache = cache;

        return cache.length;
    }

    /**
     * Retrieves the value associated with the specified ID from the set.
     * @param id The ID of the value to retrieve.
     * @returns The value associated with the ID, or undefined if the ID is not found.
     */
    public get(id:string):T | undefined
    {
        return this._set.get(id);
    }

    /**
     * Returns a generator that iterates over the elements of the FilteredSet.
     * 
     * @param startIndex - The index to start iterating from.
     * @param endIndex - The index to stop iterating at (optional).
     * @param options - Additional options for iteration (optional).
     * @param options.consistencyMode - The consistency mode for iteration (0 or 1) (optional).
     * @param options.consistencyMode 0 - highest consistency (default).
     * @param options.consistencyMode 1 - lowest consistency (optional).
     * 
     * @returns A generator that yields the elements of the FilteredSet.
     */
    public *[Symbol.iterator](startIndex:number, endIndex?:number, options?:{consistencyMode?:0|1}):Generator<T, void, undefined>
    {
        if (this._filter === undefined) 
        {
            for (const value of this._set[Symbol.iterator](startIndex, endIndex, options)) yield value;
            return;
        }

        const consistencyMode = options?.consistencyMode ?? 0;

        const cache = this._cache;
        if (cache !== undefined) 
        {
            const filtered:T[] = [];
            for (let i = startIndex, length = cache.length; i < length; i++)
            {
                if (endIndex !== undefined && i > endIndex) break;

                if (consistencyMode === 0) 
                {
                    filtered.push(cache[i]);
                    continue;
                }

                yield cache[i];
            }

            if (consistencyMode === 0) for (const value of filtered) yield value;
            
            return;
        }

        const filtered:T[] = [];
        let index = 0;
        for (const value of this._set.values(0, undefined, options))
        {
            if (this._filter(value) !== true) continue;

            if (index < startIndex) 
            {
                index++;
                continue;
            }

            if (endIndex !== undefined && index > endIndex) break;
            index++;

            if (consistencyMode === 0) 
            {
                filtered.push(value);
                continue;
            }

            yield value;
        }

        if (consistencyMode === 0) for (const value of filtered) yield value;
    }

    /**
     * An iterable function that returns the values of the FilteredSet. (alias for [Symbol.iterator])
     */
    public values = this[Symbol.iterator];
}
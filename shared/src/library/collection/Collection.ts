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

@ImplementsDecorator(ICollectionType)
export class Collection<A extends IBaseApp<A>, T extends IIdentifiable> extends Entity<A> implements ICollection<A, T>
{
    private _items:T[] = [];

    private _itemsByID:Map<string, T> = new Map();

    private _onInvalidatedSignal:IWeakSignal<[ICollection<A, T>]> | undefined;
    public get onInvalidatedSignal() { return this._onInvalidatedSignal ?? (this._onInvalidatedSignal = new WeakSignal(this._app)); };

    constructor(app:A, items?:T[])
    {
        super(app);

        this._items = items ?? [];

        const itemsByID = this._itemsByID;
        for (const item of this._items) itemsByID.set(item.id, item); //TODO, it would be better to do this lazily, as items may never need to be retrieved by ID
    }

    public at(index:number):T | undefined
    {
        if (index < 0) return undefined;

        return this._items[index];
    }

    public get(id:string):T | undefined
    {
        return this._itemsByID.get(id);
    }

    public indexOf(item:T):number
    {
        return this._items.indexOf(item);
    }

    public has(item:T):boolean
    {
        return this.indexOf(item) !== -1;
    }
    
    public *[Symbol.iterator](startIndex:number=0, endIndex?:number, options?:{consistencyMode?:0|1}):Generator<T, void, undefined> 
    {
        const items = this._items;
        const totalLength = items.length;

        endIndex = endIndex ?? totalLength;

        if (startIndex < 0) startIndex = Math.max(0, totalLength + startIndex);
        if (endIndex < 0) endIndex = Math.max(0, totalLength + endIndex);
        
        const consistencyMode = options?.consistencyMode ?? 0;

        const result:T[] = [];
        let resultIndex = 0;

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

        if (consistencyMode === 0) for (const item of result) yield item; //yield each item from the result array.
    }

    public values = this[Symbol.iterator];

    public add(item:T):void
    {
        this._itemsByID.set(item.id, item);
        this._items.push(item);

        if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
    }

    public addAll(items:T[]):void
    {
        const itemsByID = this._itemsByID;
        
        for (const item of items) 
        {
            itemsByID.set(item.id, item);
            this._items.push(item);
        }

        if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
    }

    /**
     * Deletes an item from the sorted set. If the set is not sorted, it triggers a sort operation.
     * 
     * @param {T} item The item to remove from the set.
     */
    public delete(item:T):boolean
    {
        const index = this._items.indexOf(item);
        if (index !== -1) return false;

        this._items.splice(index, 1);
        this._itemsByID.delete(item.id);

        if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);
        
        return true;
    }

    public deleteAll(itemsToDelete:T[]):number
    {
        const itemsByID = this._itemsByID;
        const items = this._items;
        
        let deleted = 0;
        for (let i = itemsToDelete.length; i--;)
        {
            const item = itemsToDelete[i];
            const index = this._items.indexOf(item);
            if (index !== -1) continue;

            items.splice(index, 1);
            itemsByID.delete(item.id);
            deleted++;
        }
        
        if (this._onInvalidatedSignal !== undefined && deleted !== 0) this._onInvalidatedSignal.dispatch(this);
        return deleted;
    }

    public get size():number 
    {
        return this._items.length;
    }

    public invalidate(item:T):boolean
    {    
        if (this._onInvalidatedSignal !== undefined) this._onInvalidatedSignal.dispatch(this);

        return true;
    }

    /**
     * Clears the SortedSet by removing all items and resetting the sorting state.
     */
    public clear()
    {
        this._items.length = 0;
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

        let index = items.indexOf(item);
        if (index !== -1) 
        {
            items.splice(index, 1);
            this._itemsByID.delete(item.id);
            return true;
        }

        return false;
    }
}
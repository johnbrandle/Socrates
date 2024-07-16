/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IStorage } from "../IStorage";
import { Store } from "./Store";
import { RestoreState } from "./RestoreState";
import { IError } from "../../error/IError";
import { IBaseApp } from "../../IBaseApp";

/**
 * Represents a storage-backed array store for managing items of a specified type.
 * @template I - The type of items stored in the array.
 * @template D - The type of data associated with each item in the array.
 */
export class BackedArrayStore<A extends IBaseApp<A>, I, D extends BasicType> extends Store<A, D>
{
    private _createItem:(data:D) => Promise<I | undefined | IError>;
    private _extractData:(item:I) => D;

    private _items:Array<I> = [];

    /**
     * Creates an instance of BackedArrayStore.
     * @param {IStorage} storage - The storage system used for data persistence.
     * @param {string} id - The unique identifier for this store.
     * @param {(data: D) => Promise<I>} createItem - A function that creates an item from data.
     * @param {(item: I) => D} extractData - A function that extracts data from an item.
     * @param {() => boolean} [storeData] - An optional function to determine if data should be stored.
     */
    constructor(storage:IStorage<A>, id:string, createItem:(data:D) => Promise<I | undefined | IError>, extractData:(item:I) => D, storeData?:() => boolean, autoCommit:boolean = false)
    {
        super(storage, id, storeData, autoCommit);

        this._createItem = createItem;
        this._extractData = extractData;
    }

     /**
     * Restores the store's state from storage.
     * @returns {Promise<BackedArrayStore<I, D>>} A promise that resolves to the restored store.
     * @throws {Error} Throws an error if the store is not in the default state.
     */
    public async restore():Promise<BackedArrayStore<A, I, D> | IError>
    {
        try
        {
            if (this._restoreState !== RestoreState.Default) this._storage.app.throw('store must be in default state', [], {correctable:true});

            this._restoreState = RestoreState.Restoring;

            const array = this._storage.app.extractOrRethrow(await this.getStoredData<Array<D>>()) ?? [];
            if (array.length == 0) 
            {
                this._restoreState = RestoreState.Restored;
                return this;
            }

            const createItem = this._createItem;
            const items = this._items;
            for (let i = 0, length = array.length; i < length; i++) 
            {
                const item = this._storage.app.extractOrRethrow(await createItem(array[i]));
                if (item === undefined) 
                {
                    this._storage.app.consoleUtil.warn(this.constructor, 'failed to create item from data', array[i]);
                    continue;
                }
                
                items.push(item);
            }
            this._restoreState = RestoreState.Restored;

            return this;
        }
        catch (error)
        {
            return this._storage.app.warn(error, 'Failed to restore store', arguments, {errorOnly:true, names:[this.constructor, this.restore]});
        }
    }

    /**
     * Replaces the current items in the store with a new array of items.
     * @param {Array<I>} items - The new array of items to replace the current items.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public replace(items:Array<I>)
    {
        this.assertIsRestoredState();

        this._items.length = 0;
        for (let i = 0, length = items.length; i < length; i++) this._items.push(items[i]);

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    /**
     * Adds an item to the store.
     * @param {I} item - The item to add to the store.
     * @throws {Error} Throws an error if the store has not been restored or if the item is a duplicate.
     */
    public add(item:I)
    {
        this.assertIsRestoredState();

        if (this._items.indexOf(item) !== -1) 
        {
            this._storage.app.consoleUtil.warn(this.constructor, 'item is a duplicate');
            return;
        }

        this._items.push(item);

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    /**
     * Removes an item from the store.
     * @param {I} item - The item to remove from the store.
     * @throws {Error} Throws an error if the store has not been restored or if the item is not found.
     */
    public remove(item:I)
    {
        this.assertIsRestoredState();

        let index = this._items.indexOf(item);
        if (index == -1) 
        {
            this._storage.app.consoleUtil.warn(this.constructor, 'item not found');
            return;
        }

        this._items.splice(index, 1);

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    /**
     * Clears all items from the store.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public clear()
    {
        this.assertIsRestoredState();

        this._items.length = 0;

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    /**
     * Checks if the store contains a specific item.
     * @param {I} item - The item to check for.
     * @returns {boolean} `true` if the item is found; otherwise, `false`.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public has(item:I):boolean
    {
        this.assertIsRestoredState();

        return this._items.indexOf(item) !== -1;
    }

    /**
     * Returns an iterator for iterating over the items in the store.
     * @yields {I} The next item in the store.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public *items():Generator<I>
    {
        this.assertIsRestoredState();

        for (let i = 0, length = this._items.length; i < length; i++) yield this._items[i];
    }

    /**
     * Gets the number of items in the store.
     * @returns {number} The number of items in the store.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public get length():number
    {
        this.assertIsRestoredState();

        return this._items.length;
    }

    /**
     * Finds an item in the store that matches a specified predicate function.
     * @param {(item: I) => boolean} predicate - A function that tests each item in the store.
     * @returns {I | undefined} The first item in the store that matches the predicate, or `undefined` if none is found.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public find(predicate:(item:I) => boolean):I | undefined
    {
        this.assertIsRestoredState();

        return this._items.find(predicate);
    }

    public findIndex(predicate:(item:I) => boolean):number 
    {
        this.assertIsRestoredState();
    
        return this._items.findIndex(predicate);
    }

    /**
     * Checks if at least one item in the store matches a specified predicate function.
     * @param {(item: I) => boolean} predicate - A function that tests each item in the store.
     * @returns {boolean} `true` if at least one item in the store matches the predicate; otherwise, `false`.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public some(predicate:(item:I) => boolean):boolean
    {
        this.assertIsRestoredState();

        return this._items.some(predicate);
    }

    /**
     * Retrieves the store's data as an array of data extracted from the items.
     * @returns {BasicType} An array of data from the items in the store.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public override getData():BasicType
    {
        this.assertIsRestoredState();

        const array = [];
        const items = this._items;

        for (let i = 0, length = items.length; i < length; i++) 
        {
            const data = this._extractData(items[i]);
            if (data === undefined) 
            {
                this._storage.app.consoleUtil.warn(this.constructor, 'failed to extract data from item', items[i]);
                continue;
            }
            array.push(data);
        }

        return array;
    }
}

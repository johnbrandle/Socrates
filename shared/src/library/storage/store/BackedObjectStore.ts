/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IStorage} from "../IStorage";
import { Store } from "./Store";
import { RestoreState } from "./RestoreState";
import { IError } from "../../error/IError";
import { IBaseApp } from "../../IBaseApp";

/**
 * A specialized store for managing a single object backed by storage.
 * @template I - The type of the object item.
 * @template D - The type of the data that represents the object item.
 */
export class BackedObjectStore<A extends IBaseApp<A>, I, D extends BasicType> extends Store<A, D>
{
    private _createItem:(data:D) => Promise<I | undefined | IError>;
    private _extractData:(item:I) => D;

    private _item:I | undefined;

    /**
     * Creates an instance of `BackedObjectStore`.
     * @param {IStorage} storage - The storage system to use for data storage.
     * @param {string} id - The unique identifier for this store.
     * @param {(data:D) => Promise<I>} createItem - A function to create an object item from data.
     * @param {(item:I) => D} extractData - A function to extract data from an object item.
     * @param {() => boolean} [storeData] - Optional function to determine if data should be stored.
     */
    constructor(storage:IStorage<A>, id:string, createItem:(data:D) => Promise<I | undefined | IError>, extractData:(item:I) => D, storeData?:() => boolean, autoCommit:boolean = false)
    {
        super(storage, id, storeData, autoCommit);

        this._createItem = createItem;
        this._extractData = extractData;
    }

    /**
     * Restores the store's state from storage.
     * @returns {Promise<BackedObjectStore<I, D>>} A promise that resolves to the restored store.
     * @throws {Error} If the store is not in the default state.
     */
    public async restore():Promise<BackedObjectStore<A, I, D> | IError>
    {
        try
        {
            if (this._restoreState !== RestoreState.Default) this._storage.app.throw('store must be in default state', [], {correctable:true});

            this._restoreState = RestoreState.Restoring;

            const data = this._storage.app.extractOrRethrow(await this.getStoredData<D>());
            if (data === undefined) 
            {
                this._restoreState = RestoreState.Restored;
                return this;
            }

            this._item = this._storage.app.extractOrRethrow(await this._createItem(data));

            this._restoreState = RestoreState.Restored;
            
            return this;
        }
        catch (error)
        {
            return this._storage.app.warn(error, 'Failed to restore store', arguments, {errorOnly:true, names:[BackedObjectStore, this.restore]});
        }
    }

    /**
     * Sets the object item for this store.
     * @param {I | undefined} item - The object item to set.
     * @throws {Error} If the store has not been restored.
     */
    public set value(item:I | undefined)
    {
        this.assertIsRestoredState();

        this._item = item;

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    /**
     * Retrieves the object item from this store.
     * @returns {I | undefined} The object item, or undefined if not set.
     * @throws {Error} If the store has not been restored.
     */
    public get value():I | undefined
    {
        this.assertIsRestoredState();

        return this._item;
    }

    /**
     * Clears the object item from this store.
     * @throws {Error} If the store has not been restored.
     */
    public clear()
    {
        this.assertIsRestoredState();

        this._item = undefined;

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    /**
     * Retrieves the data represented by the object item.
     * @returns {BasicType} The extracted data.
     * @throws {Error} If the store has not been restored, or if the item is undefined.
     */
    public override getData():BasicType | undefined
    {
        this.assertIsRestoredState();

        if (this._item === undefined) return undefined;

        return this._extractData(this._item);
    }
}

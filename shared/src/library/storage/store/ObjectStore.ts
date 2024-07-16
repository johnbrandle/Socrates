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
 * A store for managing a single value of a specific type backed by storage.
 * @template D - The type of the data that represents the stored value.
 */
export class ObjectStore<A extends IBaseApp<A>, D extends BasicType> extends Store<A, D>
{
    private _defaultValue:D;

    private _value:D | undefined;

    /**
     * Creates an instance of `ObjectStore`.
     * @param {IStorage} storage - The storage system to use for data storage.
     * @param {string} id - The unique identifier for this store.
     * @param {D} defaultValue - The default value for this store.
     * @param {() => boolean} [storeData] - Optional function to determine if data should be stored.
     */
    constructor(storage:IStorage<A>, id:string, defaultValue:D, storeData?:() => boolean, autoCommit:boolean=false)
    {
        super(storage, id, storeData, autoCommit);

        this._defaultValue = defaultValue;
    }

    /**
     * Restores the store's state from storage.
     * @returns {Promise<ObjectStore<D>>} A promise that resolves to the restored store.
     * @throws {Error} If the store is not in the default state.
     */
    public async restore():Promise<ObjectStore<A, D> | IError>
    {
        try
        {
            if (this._restoreState !== RestoreState.Default) this._storage.app.throw('store must be in default state', [], {correctable:true});

            this._restoreState = RestoreState.Restoring;

            const data = this._storage.app.extractOrRethrow(await this.getStoredData<D>());
            this._value = data === undefined ? this._defaultValue : data;

            this._restoreState = RestoreState.Restored;

            return this;
        }
        catch (error)
        {
            return this._storage.app.warn(error, 'Failed to restore store', arguments, {errorOnly:true, names:[ObjectStore, this.restore]});
        }
    }

    /**
     * Sets the value for this store.
     * @param {D} value - The value to set.
     * @throws {Error} If the store has not been restored, or if the value is equal to the current value.
     */
    public set value(value:D)
    {
        this.assertIsRestoredState();

        if (this.isEqual(this._value, value) === true) return;

        this._value = value;

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    /**
     * Retrieves the value from this store.
     * @returns {D} The stored value.
     */
    public get value():D
    {
        this.assertIsRestoredState();

        return this._value ?? this._defaultValue;
    }

    /**
     * Retrieves the data represented by the stored value.
     * @returns {BasicType} The stored data.
     */
    public override getData():BasicType
    {
        return this.value;
    }
}

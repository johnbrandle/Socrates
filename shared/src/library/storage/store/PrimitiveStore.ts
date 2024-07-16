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
 * A store for managing a single primitive value (string, boolean, or number) backed by storage.
 * @template D - The type of the primitive value to be stored.
 */
export class PrimitiveStore<A extends IBaseApp<A>, D extends string | boolean | number> extends Store<A, D>
{
    private _defaultValue:D;

    private _value:D | undefined;
    
    /**
     * Creates an instance of `PrimitiveStore`.
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
     * @returns {Promise<PrimitiveStore<D>>} A promise that resolves to the restored store.
     * @throws {Error} If the store is not in the default state.
     */
    public async restore():Promise<PrimitiveStore<A, D> | IError>
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
            return this._storage.app.warn(error, 'Failed to restore store', arguments, {errorOnly:true, names:[PrimitiveStore, this.restore]});
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

        if (value === this._value) return;

        this._value = value;

        if (this._autoCommit && this._group === undefined) this.commit(); //auto commit if not part of a group
    }

    /**
     * Retrieves the value from this store.
     * @returns {D} The stored value.
     * @throws {Error} If the store has not been restored, or if the value is undefined.
     */
    public get value():D
    {
        this.assertIsRestoredState();

        if (this._value === undefined) return this._storage.app.throw('value is undefined', [], {correctable:true});

        return this._value;
    }

    /**
     * Retrieves the data represented by the stored value.
     * @returns {BasicType} The stored data.
     */
    public override getData():BasicType
    {
        this.assertIsRestoredState();
        
        return this._value === undefined ? this._defaultValue : this._value;
    }
}

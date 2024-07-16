/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IError } from "../../error/IError";
import { IBaseApp } from "../../IBaseApp";
import { ResolvePromise } from "../../promise/ResolvePromise";
import type { IStorage } from "../IStorage";
import type { GroupStore } from "./GroupStore";
import { RestoreState } from "./RestoreState";

/**
 * Abstract base class for a data store that can be restored, modified, and committed.
 * @template D - The type of data stored in the store.
 */
export abstract class Store<A extends IBaseApp<A>, D extends BasicType>
{
    protected _storage:IStorage<A>;
    protected _id:string;
    protected _storeData?:() => boolean;
    protected _autoCommit:boolean;

    protected _restoreState:RestoreState = RestoreState.Default;

    protected _group:GroupStore<A> | undefined;

    private _busy = false;
    private _queued = false;
    private _promises:ResolvePromise<true | IError>[] = [];
    
    /**
     * Creates an instance of the Store class.
     * @param {IStorage} storage - The storage provider for the store.
     * @param {string} id - The unique identifier for the store.
     * @param {() => boolean} [storeData] - An optional function to determine if data should be stored.
     * @throws {Error} Throws an error if the provided ID is invalid.
     */
    constructor(storage:IStorage<A>, id:string, storeData?:() => boolean, autoCommit=false)
    {
        if (!id) storage.app.throw('Invalid id', [id], {correctable:true});

        this._storage = storage;
        this._id = id;
        this._storeData = storeData;
        this._autoCommit = autoCommit;
    }

    /**
     * Restores the store's state from storage.
     * @returns {Promise<Store<D>>} A promise that resolves to the restored store.
     */
    public abstract restore():Promise<Store<A, D> | IError>;

    /**
     * Gets the restore state of the store.
     * @returns {RestoreState} The restore state of the store.
     */
    public get restoreState():RestoreState
    {
        return this._restoreState; 
    }

    /**
     * Sets the group to which the store belongs.
     * @param {GroupStore<D>} group - The group to which the store belongs.
     * @throws {Error} Throws an error if the store already has a group.
     */
    public set group(group:GroupStore<A>)
    {
        if (this._group) this._storage.app.throw('Store already has a group', [], {correctable:true});

        this._group = group;
    }

    /**
     * Gets the group to which the store belongs, if any.
     * @returns {GroupStore<A, D> | undefined} The group to which the store belongs, or undefined if not in a group.
     */
    public get group():GroupStore<A> | undefined
    {
        return this._group;
    }

    /**
     * Gets the unique identifier of the store.
     * @returns {string} The store's unique identifier.
     */
    public get id():string
    {
        return this._id;
    }

    /**
     * Gets the storage provider associated with the store.
     * @returns {IStorage} The storage provider for the store.
     */
    public get storage():IStorage<A>
    {
        return this._storage;
    }

    /**
     * Gets the store's data.
     * @returns {BasicType} The store's data.
     */
    public abstract getData():BasicType;

    public async getStoredData<T extends BasicType>():Promise<T | undefined | IError>
    {
        try
        {
            if (this._group !== undefined) return this._storage.app.extractOrRethrow(await this._group.getStoredData<T>(this));

            return this._storage.app.extractOrRethrow(await this._storage.get<T>(this._id, true));
        }
        catch (error)
        {
            return this._storage.app.warn(error, 'Failed to get stored data', arguments, {errorOnly:true, names:[Store, this.getStoredData]});
        }
    }

    /**
     * Checks if two values are equal, including handling various data types.
     * @param {BasicType} value1 - The first value to compare.
     * @param {BasicType} value2 - The second value to compare.
     * @returns {boolean} True if the values are equal; otherwise, false.
     */
    protected isEqual(value1:BasicType, value2:BasicType):boolean 
    {
        //check for null values
        if (value1 === null || value2 === null) this._storage.app.throw('Null values should be represented as undefined', [], {correctable:true});

        const typeOfValue1 = typeof value1;

        //check if the types are the same
        if (typeOfValue1 !== typeof value2) return false;
    
        switch (typeOfValue1)
        {
            case 'undefined':
                return true;
            case 'string':
            case 'number':
            case 'boolean':
                return value1 === value2;
            case 'object':
                return JSON.stringify(value1) === JSON.stringify(value2);        
        }

        //if none of the above cases match, consider them not equal
        return false;
    }

    /**
     * Commits changes made to the store's data to the underlying storage provider. This method
     * serializes the store's data and stores it in the storage identified by the store's unique
     * identifier. If the data is undefined, the store's data is removed from storage. The commit
     * operation is asynchronous and returns a promise that resolves to true if the commit is
     * successful, indicating that the data has been stored or removed from storage. If the commit
     * encounters an error, it resolves to false, and the error details are logged.
     *
     * Before calling this method, ensure that the store has been restored and is in a restored state.
     * Additionally, if the store belongs to a group, it must be committed through the group.
     *
     * @returns {Promise<true | IError>} A promise that resolves to true if the commit is successful
     * @example
     * 
     * await myStore.restore();
     * const success = await myStore.commit();
     * if (success) {
     *   ConsoleUtil.log('Data has been successfully committed to storage.');
     * } else {
     *   console.error('Failed to update storage container data.');
     * }
     */
    public async commit():Promise<true | IError> 
    {
        let success:IError | true = true;

        try 
        {
            this.assertIsRestoredState();
        
            if (this._group !== undefined) this._storage.app.throw('Store must be committed through group', []);

            //if already queued, return a Promise that resolves based on the result
            if (this._queued) 
            {
                const promise = new ResolvePromise<true | IError>();
                this._promises.push(promise);

                return promise;
            }
            //if busy, queue the commit and return a Promise that resolves based on the result
            if (this._busy) 
            {
                this._queued = true;

                const promise = new ResolvePromise<true | IError>();
                this._promises.push(promise);

                return promise;
            }
            this._busy = true;
        
            do 
            {
                this._queued = false;
    
                if (this._storeData !== undefined && !this._storeData()) continue;
    
                const data = this.getData();

                if (data === undefined) this._storage.app.extractOrRethrow(await this._storage.remove(this._id));
                else this._storage.app.extractOrRethrow(await this._storage.set(this._id, data));
            } 
            while (this._queued);

            return success;
        } 
        catch (error) 
        {
            return success = this._storage.app.warn(error, 'Failed to commit store data', arguments, {errorOnly:true, names:[Store, this.commit]});
        } 
        finally 
        {
            this._queued = this._busy = false;

            //resolve any promises with the result
            let promises = this._promises.slice();
            this._promises.length = 0; //clear the array

            for (const promise of promises) promise.resolve(success);
        }
    }

    protected assertIsRestoredState = ():void => { if (this._restoreState !== RestoreState.Restored) this._storage.app.throw('Store has not been restored', [], {correctable:true}); }
}

/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Store } from "./Store";
import { RestoreState } from "./RestoreState";
import { ResolvePromise } from "../../promise/ResolvePromise";
import { IError } from "../../error/IError";
import { IBaseApp } from "../../IBaseApp";

/**
 * Represents a group of related stores that share data and commit changes collectively.
 */
export class GroupStore<A extends IBaseApp<A>>
{
    private readonly _app:A;

    private readonly _stores:Array<Store<A, BasicType>> = [];
    private readonly _storeData?:() => boolean;

    private readonly _id:string = '';

    protected _restoreState:RestoreState = RestoreState.Default;

    private _busy:boolean = false;
    private _queued:boolean = false;
    private _promises:ResolvePromise<true | IError>[] = [];

    private _stringifiedData:string | undefined;
    private _data:Array<BasicType> | undefined;

    /**
     * Creates an instance of GroupStore.
     * @param {Array<Store<D>>} stores - An array of stores to be included in the group.
     * @param {() => boolean} [storeData] - An optional function to determine if data should be stored.
     * @throws {Error} Throws an error if the number of stores is less than 2 or if stores have different storage values.
     */
    constructor(app:A, stores:Array<Store<A, BasicType>>, storeData?:() => boolean)
    {
        this._app = app;

        this._storeData = storeData;

        if (stores.length < 2) app.throw('must have at least 2 stores', [], {correctable:true});

        //verify the stores share the same storage value, collect the store ids, set the group to the store, and copy the array
        let copy = [];
        let storeIDs = [];
        for (let i = 0, length = stores.length; i < length; i++) 
        {
            let store = copy[i] = stores[i];

            storeIDs[i] = store.id;
            store.group = this;

            if (store.restoreState !== RestoreState.Default) app.throw('store must be in default state', [], {correctable:true});
            if (store.storage !== stores[0].storage) app.throw('stores must share the same storage value', [], {correctable:true});
        }
        this._id = storeIDs.join('-');
        this._stores = copy;
    }

    /**
     * Restores the group's state from storage and restores individual store states.
     * @returns {Promise<GroupStore>} A promise that resolves to the restored group.
     * @throws {Error} Throws an error if the group or any store is not in the default state.
     */
    public async restore():Promise<GroupStore<A> | IError>
    {
        try
        {
            if (this._restoreState !== RestoreState.Default) this._app.throw('store must be in default state', [], {correctable:true});

            this._restoreState = RestoreState.Restoring;
            
            const stores = this._stores;
            const storage = stores[0].storage;

            this._data = this._app.extractOrRethrow(await storage.get<BasicType[]>(this._id + '-data', true)) ?? [];
            this._stringifiedData = this._app.jsonUtil.stringify(this._data);

            for (let i = 0, length = stores.length; i < length; i++) 
            {
                const store = stores[i];
                
                if (store.restoreState === RestoreState.Default) this._app.extractOrRethrow(await store.restore());
            }

            this._restoreState = RestoreState.Restored;

            return this;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to restore group', arguments, {errorOnly:true, names:[GroupStore, this.restore]});
        }
    }

    /**
     * Gets the restore state of the group.
     * @returns {RestoreState} The restore state of the group.
     */
    public get restoreState():RestoreState
    {
        return this._restoreState; 
    }

    /**
     * Gets the stored data associated with a specific store in the group.
     * @param {Store<D>} store - The store for which to retrieve stored data.
     * @returns {T | undefined} The stored data for the store, or undefined if not restored.
     * @throws {Error} Throws an error if the store has not been restored.
     */
    public async getStoredData<T extends BasicType>(store:Store<A, T>):Promise<T | undefined | IError>
    {
        try
        {
            if (this._restoreState === RestoreState.Default) this._app.throw('store has not been restored', [], {correctable:true});

            if (!this._data?.length) return undefined;

            const index = this._stores.indexOf(store);
            if (index === -1) this._app.throw('store is not part of a group', [], {correctable:true});

            return this._data[index] as T;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to get stored data', arguments, {errorOnly:true, names:[GroupStore, this.getStoredData]});
        }
    }

    /**
     * Commits changes made to the group's stores collectively to storage.
     * @returns {Promise<boolean>} A promise that resolves to true if the commit is successful; otherwise, false.
     * @throws {Error} Throws an error if the group or any store has not been restored.
     */
    public async commit():Promise<true | IError> 
    {
        let success:IError | true = true;

        try 
        {
            this.#assertIsRestoredState();

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
    
                const id = this._id;
                const stores = this._stores;
                const storage = stores[0].storage;

                //step 1, collect the current data from the stores
                const datas:Array<BasicType> = [];
                for (let i = 0, length = stores.length; i < length; i++) 
                {
                    const store = stores[i];
                    
                    const data = store.getData();
                    datas.push(data);
                }

                //if the data is the same, skip the rest
                const stringifiedData = this._app.jsonUtil.stringify(datas);
                if (this._stringifiedData === stringifiedData) continue;

                this._stringifiedData = stringifiedData;
                this._data = datas;

                //step 2, store the data
                this._app.extractOrRethrow(await storage.set(id + '-data', datas));
            } 
            while (this._queued);

            return success;
        } 
        catch (error) 
        {
            return success = this._app.warn(error, 'failed to commit group data', arguments, {errorOnly:true, names:[GroupStore, this.commit]});
        } 
        finally 
        {
            this._queued = this._busy = false;

            //resolve any queued callbacks with the result
            let promises = this._promises.slice();
            this._promises.length = 0; //clear the array

            for (const promise of promises) promise.resolve(success);
        }
    }

    #assertIsRestoredState = ():void => { if (this._restoreState !== RestoreState.Restored) this._app.throw('Store has not been restored', [], {correctable:true}); }
}

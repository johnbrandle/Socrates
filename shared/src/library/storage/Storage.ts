/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IStorage } from "./IStorage.ts";
import { IBaseStorageAPIType, IStorageType, type IStorageTree, type ITransactionAPI } from "./IStorage.ts";
import { BaseOutputFormat, CharSet, type base62, type base64 } from "../utils/BaseUtil.ts";
import { Entity } from "../entity/Entity.ts";
import { KeyType, type CRYPTKey, type HKDFKey, type HMACKey } from "../utils/KeyUtil.ts";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator.ts";
import { IBaseApp } from "../IBaseApp.ts";
import { HashOutputFormat, HashType, hex_128 } from "../utils/HashUtil.ts";
import { uid } from "../utils/UIDUtil.ts";
import { HMACOutputFormat } from "../utils/HMACUtil.ts";
import type { CRYPT } from "../utils/CryptUtil.ts";
import type { IError } from "../error/IError.ts";
import { ResolvePromise } from "../promise/ResolvePromise.ts";
import { __is } from "../utils/__internal/__is.ts";

export const i_parentStorageID = 'i_parentStorageID'; //index
export const i_thisStorageID = 'i_thisStorageID'; //index

export interface StorageModel extends Record<string, any>
{
    key:base64;
    value:base64;

    indexes:Array<string>;

    signature:string;
}

@ImplementsDecorator(IStorageType, IBaseStorageAPIType)
export abstract class Storage<A extends IBaseApp<A>> extends Entity<A> implements IStorage<A>
{
    protected _hkdfKey?:HKDFKey; //shared
    protected _hmacKey?:HMACKey<HashType.SHA_256>; //shared
    protected _cryptKey?:CRYPTKey; //shared
    
    protected _unhashedIndexes:string[]; //not shared
    protected _hashedIndexes:string[] = []; //not shared
    private _indexesHashedPromise?:Promise<void>; //not shared
    private readonly _createdHashIndexes:Record<string, boolean> = {}; //shared

    protected _config = this._app.configUtil.get(true);

    protected _ready = false; //not shared

    /**
     * True if an operation is in progress
     */
    private _busy = false; //not shared

    /**
     * Queue for regular operations.
     */
    protected _queue:Array<{operation:() => Promise<any>, resolve:(value:any) => void}> = []; //not shared

    /**
     * Queue specifically for transactional operations. It ensures that operations within a transaction are completed in series without interruption.
     */
    protected _transactionQueue:Array<{operation:() => Promise<any>, resolve:(value:any) => void}> | undefined; //not shared

    protected readonly _baseStorageID:string; //shared
    protected readonly _parentStorageID:string; //not shared
    public readonly id:string; //not shared

    constructor(app:A, uid:uid, hkdfKey?:HKDFKey);
    constructor(storage:Storage<A>, uid:uid);
    constructor(...args:any[])
    {
        if (__is<Storage<A>>(args[0], Storage) === true)
        {
            const [storage, uid] = args as [Storage<A>, uid];

            super(storage.app, uid);

            this._baseStorageID = storage._baseStorageID;
            this._parentStorageID = storage.id;
            this.id = this._parentStorageID + uid + '/';
            
            this._hkdfKey = storage._hkdfKey;
            this._hmacKey = storage._hmacKey;
            this._cryptKey = storage._cryptKey;
            
            //skip the other index hash properties, because they are not shared between instances
            this._createdHashIndexes = storage._createdHashIndexes;
        }
        else 
        {
            const [app, uid, hkdfKey] = args as [A, uid, HKDFKey?];

            super(app, uid);

            this._parentStorageID = '';
            this.id = uid + '/';
            this._baseStorageID = this.id;

            this._hkdfKey = hkdfKey;
        }

        this._unhashedIndexes = [i_parentStorageID, i_thisStorageID];
    }

    protected async ready():Promise<void>
    {
        if (this._ready === true) return;

        //check if ready is already in progress, if so return the promise
        const indexesHashedPromise = this._indexesHashedPromise;
        if (indexesHashedPromise !== undefined) return indexesHashedPromise;

        const hkdfKey = this._hkdfKey;
        if (hkdfKey !== undefined) 
        {
            const config = this._config.classes.Storage;

            this._hmacKey = await this._app.keyUtil.derive(hkdfKey, config.frozen.hmacLabel_hex_128 as hex_128, KeyType.HMAC, HashType.SHA_256);
            this._cryptKey = await this._app.keyUtil.derive(hkdfKey, config.frozen.cryptLabel_hex_128 as hex_128, KeyType.CRYPT); 
        }
        
        const hashIndexes = async ():Promise<void> =>
        {
            const unhashedIndexes = this._unhashedIndexes;
            const hashedIndexes = this._hashedIndexes;
            for (let i = 0, length = unhashedIndexes.length; i < length; i++) 
            {
                hashedIndexes[i] = await this.hash(unhashedIndexes[i]);
    
                if (this._createdHashIndexes[unhashedIndexes[i]] !== undefined) continue; //skip, already created
                this._createdHashIndexes[unhashedIndexes[i]] = true;
    
                this.createIndex(hashedIndexes[i]);
    
                this.log('created db index', unhashedIndexes[i], hashedIndexes[i]);
            }
        }

        //set _ready to true after hashIndexes completes
        return this._indexesHashedPromise = hashIndexes().then(() => void (this._ready = true));
    }

    protected abstract createIndex(indexName:string):void; //override to add implementation specific index creation logic

    /**
     * Generates a signature for the given storage document.
     * hashes the key, value, and all indexes, and then concatenates them together and hashes the result.
     * @param document - The storage document to generate a signature for.
     * @returns A string representing the signature for the given document.
     * @throws {Error} If the storage is not ready.
     */
    protected getSignature(document:StorageModel):Promise<base62>
    {
        if (this._ready !== true) this._app.throw('storage not ready', [], {correctable:true});
        
        const indexes = document.indexes;
        const values = new Array(indexes.length);
        for (let i = indexes.length; i--;) values[i] = document[indexes[i]] ?? '';

        return this.hash(document.key + document.value + values.join(''));
    }

    protected getHashedIndexName(unhashedIndexName:string):string
    {
        if (this._ready !== true) this._app.throw('storage not ready', [], {correctable:true});
        
        if (this._hmacKey === undefined) return unhashedIndexName;

        const index = this._unhashedIndexes.indexOf(unhashedIndexName);
        if (index === -1) this._app.throw('index not found', [], {correctable:true});

        return this._hashedIndexes[index];
    }

    protected async addIndexesAndSignature<T extends StorageModel>(document:T, ...args:any):Promise<T>
    {
        if (this._ready !== true) this._app.throw('storage not ready', [], {correctable:true});

        //example: document.i_baseStorageID = '/'; (the unhashed key name, and unencrypted value) this is for indexing
        let hashedIndexName = this.getHashedIndexName(i_parentStorageID);
        let hashedIndexValue = await this.hash(this._parentStorageID);
        (document as any)[hashedIndexName] = hashedIndexValue;

        hashedIndexName = this.getHashedIndexName(i_thisStorageID);
        hashedIndexValue = await this.hash(this.id);
        (document as any)[hashedIndexName] = hashedIndexValue;
        
        document.indexes = this._hashedIndexes; //array of indexes, example: ['i_parentStorageID', 'i_thisStorageID'] (unhashed version). this is so we know what index properties are on document, and so we can iterate over them when we need to
        document.signature = await this.getSignature(document);

        return document;
    }

    /**
     * Enqueues an operation to the provided queue and initiates the dequeue process.
     *
     * @template T - The return type of the operation.
     * @param {() => Promise<T>} operation - The operation to enqueue.
     * @param {Array<{operation:() => Promise<any>, resolve:(value:any) => void}>} queue - The queue to which the operation will be added.
     * @return {Promise<T>} - Returns a promise that resolves to the result of the operation.
     * @private
     */
    protected enqueue<T>(operation:() => Promise<T>, queue:Array<{operation:() => Promise<any>, resolve:(value:any) => void}>):Promise<T> 
    {
        const promise = new Promise<T>(resolve => queue.push({operation, resolve}));
    
        this.dequeue(); //initiates the dequeue process immediately after enqueuing.
    
        return promise;
    }

    /**
     * Dequeues and processes operations from the regular and transaction queues.
     * Ensures that only one dequeue operation is in progress at any given time.
     * 
     * @private
     * @async
     */
    protected async dequeue() 
    {
        if (this._busy === true) return; //return if a dequeue operation is already in progress.
        this._busy = true;
        
        const process = async (obj:{operation:() => Promise<any>, resolve:(value:any) => void}) =>
        {
            try
            {
                const result = await obj.operation();
                
                obj.resolve(result);
            }
            catch(error) //should never happen. all operations should be resiliant to errors (they should have their own try catch handlers, and they should be sufficient so as to prevent errors from escaping)
            {
                this._app.consoleUtil.error(this.constructor, 'operations should not throw');

                throw error;
            }
        }

        while (this._queue.length || (this._transactionQueue && this._transactionQueue.length)) //continue processing as long as there are items in either queue.
        {
            //process the regular queue as long as there's no ongoing transaction
            while (this._queue.length && !this._transactionQueue) await process(this._queue.shift()!);
            
            //if there's a transaction, process the transaction queue
            while (this._transactionQueue && this._transactionQueue.length) await process(this._transactionQueue.shift()!);

            //if the transaction is still open, but there are no items in the transaction queue, break, even if there are items in the normal queue
            if (this._transactionQueue && !this._transactionQueue.length) break;
        }
    
        this._busy = false;
    }

    /**
     * Initiates a transaction, ensuring that only one transaction is processed at a time.
     * Enqueues the entire transaction operation to the regular queue.
     *
     * The method ensures that operations within the transaction are executed in sequence,
     * without interruption by other transactions or non-transactional operations.
     * The #dequeue method handles the processing of the queue, adhering to these rules.
     * 
     * WARNING: do not directly call and await other methods like set, has, remove, etc. inside the transaction func, as this will cause a deadlock. (this is easy to do indirectly, like calling a method that calls set)
     * 
     * Example issue:
     * 
     * async (api) =>
     * {
     *     await this.set(key, value);       //enqueues and executes a 'set' operation, but it is doing so on the main queue, not the transaction queue.
     *     await api.get(key);              //enqueues and executes a 'get' operation within the transaction, but it will never be processed because await this.set(...) will never finish
     * }
     * 
     * WARNING: this contains no rollback functionality, so if an error occurs, the transaction will be left in an inconsistent state.
     * 
     * Example func:
     * 
     * async (api) =>
     * {
     *      await api.set(key, value);       //enqueues and executes a 'set' operation within the transaction.
     *      window.setTimeout(...);          //other code can run here, but other queue operations are blocked until the transaction completes.
     * 
     *      //given the logic in #dequeue, nothing outside of the transaction can run until this function completes.
     *      await api.get(key);              //enqueues and executes a 'get' operation within the transaction, immediately after the 'set'.
     * }
     * 
     * @param {(batchAPI:ITransactionAPI) => Promise<void>} func - A function that takes a transaction API and returns a promise.
     * @return {Promise<boolean>} - Returns a promise that resolves when the transaction is complete. true if all api operations completed successfully, false otherwise.
     * @public
     */
    public async transaction(func:(batchAPI:ITransactionAPI<A>) => Promise<true | IError | void>, batchAPI?:ITransactionAPI<A>):Promise<true | IError>
    {
        if (batchAPI !== undefined) 
        {
            if (batchAPI.belongsTo(this) !== true) this._app.throw('transaction does not belong to storage', [], {correctable:true});

            return (await func(batchAPI)) ?? true; //if the func throws, it should be caught by operation (see below)
        }

        let success:true | IError = true;
        const promise = new ResolvePromise<true | IError>();

        const operation = async ():Promise<void> =>
        {
            (async ():Promise<void> =>
            {
                if (this._transactionQueue) this._app.throw('transaction already in progress', []); //likely caused by calling batch inside a batch func
                this._transactionQueue = [];

                const ref = this;
                const app = this._app;
                const transactionQueue = this._transactionQueue;

                const transactionAPI:ITransactionAPI<A> = 
                {
                    async set<T extends BasicType | BasicType[]>(key:string | string[], value:T | T[]):Promise<true | IError> 
                    {
                        if (success !== true) return success;
                        
                        return success = await ref.enqueue(() => ref._set<T>(key, value), transactionQueue);
                    },
                
                    async get<T extends BasicType | [...BasicType[]]>(key:string | string[], isOkayIfNotExists?:boolean):Promise<T | undefined | {[K in keyof T]: T[K]} | IError | {[K in keyof T]: T[K] | undefined}>
                    {
                        if (success !== true) return success;

                        const result = await ref.enqueue(() => ref._get<T>(key, isOkayIfNotExists), transactionQueue);
                        if (app.typeUtil.isError(result) === true) success = result;

                        return result;
                    },

                    async find<T extends BasicType>(...query:any):Promise<T[] | IError>
                    {
                        if (success !== true) return success;

                        const result = await ref.enqueue(() => ref._find(...query), transactionQueue);
                        if (app.typeUtil.isError(result) === true) success = result;

                        return result as T[] | IError;
                    },

                    async keys():Promise<string[] | IError>
                    {
                        if (success !== true) return success;

                        const result = await ref.enqueue(() => ref._keys(false), transactionQueue);
                        if (app.typeUtil.isError(result) === true) success = result;

                        return result;
                    },

                    async has(key:string):Promise<boolean | IError>
                    {
                        if (success !== true) return success;

                        const result = await ref.enqueue(() => ref._has(key), transactionQueue);
                        if (app.typeUtil.isError(result) === true) success = result;

                        return result;
                    },
                
                    async remove(key:string | Array<string>):Promise<true | IError> 
                    {
                        if (success !== true) return success;

                        return success = await ref.enqueue(() => ref._remove(key), transactionQueue);
                    },

                    async clear():Promise<true | IError> 
                    {
                        if (success !== true) return success;

                        return success = await ref.enqueue(() => ref._clear(), transactionQueue);
                    },

                    belongsTo(storage:IStorage<A>):boolean 
                    {
                        return storage === ref;
                    }
                }

                try
                {
                    const result = await func(transactionAPI);
                    
                    if (app.typeUtil.isError(result) === true) success = result;
                }
                catch(e)
                {
                    success = this._app.warn(e, 'transaction failed', arguments, {errorOnly:true, names:[Storage, this.transaction]});
                }

                this._transactionQueue = undefined;

                promise.resolve(success);

                this.dequeue(); //so items in the standard queue can be processed, now that we have set this._transactionQueue to undefined
            })(); //we do not wait for this promise because if we do, no operations called in func will be able to execute (there may be calls like await transactionAPI.set(...) in func)
        };

        this.enqueue(operation, this._queue); //enqueues the entire transaction operation to the regular queue.

        return promise;
    }

    public async set<T extends BasicType>(key:string, value: T): Promise<true | IError>;
    public async set<T extends BasicType>(keys:Array<string>, values:Array<T>):Promise<true | IError>;
    public async set<T extends BasicType>(key:string | Array<string>, value: T | Array<T>):Promise<true | IError>
    {
        return this.enqueue(() => this._set(key, value), this._queue);
    }
    protected abstract _set<T extends BasicType | BasicType[]>(key:string | Array<string>, value:T | Array<T>):Promise<true | IError>;

    public async get<T extends BasicType>(key:string, isOkayIfNotExists?:false):Promise<T | IError>;
    public async get<T extends BasicType>(key:string, isOkayIfNotExists:true):Promise<T | undefined | IError>;
    public async get<T extends [...BasicType[]]>(keys:Array<string>, isOkayIfNotExists?:false):Promise<{[K in keyof T]: T[K]} | IError>;
    public async get<T extends [...BasicType[]]>(keys:Array<string>, isOkayIfNotExists:true):Promise<{[K in keyof T]: T[K] | undefined} | IError>;
    public async get<T extends BasicType | [...BasicType[]]>(key:string | Array<string>, isOkayIfNotExists?:boolean)
    {
        return this.enqueue(() => this._get<T>(key, isOkayIfNotExists), this._queue);
    }
    protected abstract _get<T extends BasicType | [...BasicType[]]>(key:string | Array<string>, isOkayIfNotExists?:boolean):Promise<T | undefined | {[K in keyof T]: T[K]} | IError | {[K in keyof T]: T[K] | undefined}>;
    
    public async find<T extends BasicType>(...query:any):Promise<Array<T> | IError>
    {
        return this.enqueue(() => this._find(...query), this._queue);
    }
    protected abstract _find<T extends BasicType>(...query:any):Promise<Array<T> | IError>;
    
    public async keys():Promise<Array<string> | IError>
    {
        return this.enqueue(() => this._keys(false), this._queue);
    }
    protected abstract _keys(deep:boolean):Promise<Array<string> | IError>;

    public async has(key:string):Promise<boolean | IError>
    {
        return (await this.enqueue(() => this._get(key, true), this._queue)) !== undefined;
    }
    protected abstract _has(key:string):Promise<boolean | IError>;
    
    public async remove(key:string):Promise<true | IError>;
    public async remove(keys:Array<string>):Promise<true | IError>;
    public async remove(key:string | Array<string>):Promise<true | IError>
    {
        return this.enqueue(() => this._remove(key), this._queue);
    }
    protected abstract _remove(key:string | Array<string>):Promise<true | IError>;
    
    public async clear():Promise<true | IError>
    {
        return this.enqueue(() => this._clear(), this._queue);
    }
    protected abstract _clear():Promise<true | IError>

    public abstract getStructure():Promise<IStorageTree | IError>;

    /**
     * 
     * @param key 
     * 
     * @returns 
     * 
     * Allows the nested id structure to work, so that we can have a single database for all storage objects, but still have each storage object be separate.
     */
    protected async hashKey(key:string):Promise<string>;
    protected async hashKey(keys:Array<string>):Promise<Array<string>>;
    protected async hashKey(key:string | Array<string>):Promise<string | Array<string>>
    {
        if (this._ready !== true) this._app.throw('storage not ready', [], {correctable:true});

        const hash = this.hash;
        const prefix = await this.getKeysPrefix();

        if (Array.isArray(key) === true)
        {
            const keys = key;
            const promises = new Array(keys.length);
            for (let i = keys.length; i--;) promises[i] = hash(keys[i]).then((hash:string) => prefix + hash);

            return Promise.all(promises);
        }

        key = prefix + (await hash(key));

        return key;
    }

    protected async getKeysPrefix():Promise<string>
    {
        return (await this.hash(this.id)) + '_';
    }

    protected hash = async (value:string):Promise<base62> =>
    {
        const app = this._app;

        if (this._ready !== true && (this._hkdfKey !== undefined && this._hmacKey === undefined)) app.throw('storage not ready', [], {correctable:true}); //the logic here is a little more complicated because we call this in ready, and this._ready is false in ready

        if (this._hmacKey === undefined) return app.baseUtil.toBase62(await app.hashUtil.derive(app.hashUtil.encodeData(app.textUtil.toUint8Array(value)), HashType.SHA_256, HashOutputFormat.Hex)); //if we don't have a crypto key, just hash the value (this is for the keys)

        const hash = await this._app.hmacUtil.derive(this._hmacKey, app.hmacUtil.derivePAE([app.textUtil.toUint8Array(value)]), HMACOutputFormat.Hex);
        return this._app.baseUtil.toBase62(hash, CharSet.Base62);
    }

    protected async encrypt<T extends BasicType>(value:T):Promise<base64> //get the value converted into a string
    {
        if (this._ready !== true) this._app.throw('storage not ready', [], {correctable:true});

        try
        {
            const string = this._app.serializationUtil.toString<T>(value);

            const cryptKey = this._cryptKey;
            
            if (this._app.environment.frozen.isPlainTextMode === true || cryptKey === undefined) return this._app.baseUtil.toBase64(string);

            const encrypted = await this._app.cryptUtil.encrypt(cryptKey, this._app.textUtil.toUint8Array(string));

            return this._app.baseUtil.toBase64(encrypted);
        }
        catch (error) 
        { 
            return this._app.rethrow(error, 'failed to encrypt', arguments, {names:[Storage, this.encrypt]});
        }
    }

    protected async decrypt<T extends BasicType>(value:base64):Promise<T | IError>
    {
        if (this._ready !== true) this._app.throw('storage not ready', [], {correctable:true});

        try
        {
            const cryptKey = this._cryptKey;

            if (this._app.environment.frozen.isPlainTextMode === true || cryptKey === undefined) 
            {
                const string = this._app.extractOrRethrow(this._app.baseUtil.fromBase64(value, BaseOutputFormat.string));

                return this._app.extractOrRethrow(this._app.serializationUtil.fromString<T>(string));
            }

            const encrypted = this._app.extractOrRethrow(this._app.baseUtil.fromBase64<CRYPT<Uint8Array>>(value)); 
            const decrypted = this._app.extractOrRethrow(await this._app.cryptUtil.decrypt(cryptKey, encrypted));

            const string = this._app.textUtil.fromUint8Array(decrypted);

            return this._app.serializationUtil.fromString<T>(string);
        }
        catch (error) 
        { 
            return this._app.warn(error, 'failed to decrypt', arguments, {errorOnly:true, names:[Storage, this.decrypt]});
        }
    }
}
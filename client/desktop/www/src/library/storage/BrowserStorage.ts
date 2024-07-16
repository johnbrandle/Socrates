/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Storage, i_parentStorageID, i_thisStorageID, type StorageModel } from "../../../../../../shared/src/library/storage/Storage.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import type { IStorageTree } from "../../../../../../shared/src/library/storage/IStorage.ts";
import type { HKDFKey } from "../utils/KeyUtil.ts";
import type { uid } from "../utils/UIDUtil.ts";
import type { IError } from "../../../../../../shared/src/library/error/IError.ts";

interface IBrowserDB
{
    setItem(key:string, value:string):void;
    getItem(key:string):string | null; //we use null here because LocalStorage and SessionStorage return null if the key doesn't exist
    removeItem(key:string):void;
    key(index:number):string | null; //we use null here because LocalStorage and SessionStorage return null if the index is out of bounds
    length:number;
}

export abstract class BrowserStorage<A extends IBaseApp<A>> extends Storage<A>
{
    protected readonly _db:IBrowserDB;

    public constructor(db:IBrowserDB, app:A, uid:uid, cryptoKey?:HKDFKey);
    public constructor(db:IBrowserDB, storage:Storage<A>, uid:uid);
    public constructor(...args:any[])
    {
        if (args.length === 3)
        {
            const [db, storage, uid] = args;
            super(storage, uid);
            this._db = db;
        }
        else
        {
            const [db, app, uid, cryptoKey] = args;
            super(app, uid, cryptoKey);
            this._db = db;
        }
    }

    protected override createIndex(_indexName:string):void {}

    protected override async _set<T extends BasicType>(keys:Array<string>, values:Array<T>):Promise<true | IError>;
    protected override async _set<T extends BasicType>(key:string, value:T):Promise<true | IError>;
    protected override async _set<T extends BasicType>(key:string | Array<string>, value:T | Array<T>):Promise<true | IError>
    {
        try
        {
            await this.ready();

            if (Array.isArray(key) === true)
            {
                if (Array.isArray(value) !== true || key.length !== value.length || value.length === 0) this._app.throw('invalid arguments', []);

                const keys = key;
                const values = value;

                for (let i = 0, length = keys.length; i < length; i++)
                {
                    const result = await this._set(keys[i], values[i]);
                    if (result !== true) this._app.throw('Error setting value', [keys[i], values[i]]);
                }

                return true;
            }

            const hashedKey = await this.hashKey(key);

            const encryptedKey = await this.encrypt(key);
            if (encryptedKey === undefined) this._app.throw('encryption failed', []);

            const encryptedValue = await this.encrypt(value as T);
            if (encryptedValue === undefined) this._app.throw('encryption failed', []);
    
            const model = await this.addIndexesAndSignature({key:encryptedKey, value:encryptedValue, indexes:[], signature:''});
            const string = this._app.serializationUtil.toString(model);
            if (string === undefined) this._app.throw('serialization failed', []);

            this._db.setItem(hashedKey, string);
            
            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Error setting value', [key, value], {errorOnly:true, names:[BrowserStorage, this._set]});
        }
    }

    protected override _get<T extends BasicType>(key:string, isOkayIfNotExists?:false):Promise<T | IError>;
    protected override _get<T extends BasicType>(key:string, isOkayIfNotExists:true):Promise<T | undefined | IError>;
    protected override _get<T extends [...BasicType[]]>(keys:Array<string>, isOkayIfNotExists?:false):Promise<{ [K in keyof T]: T[K] } | IError>;
    protected override _get<T extends [...BasicType[]]>(keys:Array<string>, isOkayIfNotExists:true):Promise<{ [K in keyof T]: T[K] | undefined } | IError>;
    protected override async _get<T extends BasicType | [...BasicType[]]>(key:string | Array<string>, isOkayIfNotExists?:boolean)
    {
        try
        {
            await this.ready();
            
            if (Array.isArray(key) === true)
            {
                const keys = key;
                const values:Array<T | undefined> = [];
                for (let i = 0, length = keys.length; i < length; i++) values[i] = this._app.extractOrRethrow(await this._get<T>(keys[i], isOkayIfNotExists as any));

                return values;
            }

            const hashedKey = await this.hashKey(key);

            const string = this._db.getItem(hashedKey);

            if (string === null) return isOkayIfNotExists === true ? undefined : this._app.throw('Key not found', [key]);
            
            const model = this._app.extractOrRethrow(this._app.serializationUtil.fromString<StorageModel>(string));

            return this._app.extractOrRethrow(await this.decrypt<T>(model.value));    
        }
        catch (error)
        {
            return this._app.warn(error, 'Error getting value', [key], {errorOnly:true, names:[BrowserStorage, this._get]});
        }
    }

    public override async find<T extends BasicType | JsonObject | JsonArray>(predicate:(key:string, value:T) => boolean):Promise<Array<T> | IError>
    {
        return super.find(predicate);
    }

    protected override async _find<T extends BasicType | JsonObject | JsonArray>(predicate:(key:string, value:T) => boolean):Promise<Array<T> | IError>
    {
        try
        { 
            await this.ready();

            const prefix = await this.getKeysPrefix();

            const values:T[] = [];
            const db = this._db;
            for (let i = db.length; i--;)
            {
                const key = db.key(i);
                if (key === null) continue;
    
                if (key.startsWith(prefix) !== true) continue;

                const string = db.getItem(key);
                if (string === null) continue;

                const model = this._app.extractOrRethrow(this._app.serializationUtil.fromString<StorageModel>(string));
                
                const decryptedKey = this._app.extractOrRethrow(await this.decrypt<string>(model.key));
                const decryptedValue = this._app.extractOrRethrow(await this.decrypt<T>(model.value));
            
                if (predicate(decryptedKey, decryptedValue) !== true) continue;

                values.push(decryptedValue);
            }

            return values;
        } 
        catch (error) 
        {
            return this._app.warn(error, 'Error finding values', [], {errorOnly:true, names:[BrowserStorage, this._find]});
        }
    }

    protected async _keys(deep:boolean=false):Promise<string[] | IError> //warning: deep === true is an expensive operation, but should be fine as it is only likely to be used for debugging, or clear (which shouldn't be called too often)
    {
        try
        { 
            await this.ready();

            const keys:string[] = [];

            if (deep === false) 
            {
                const keysPrefix = await this.getKeysPrefix();
                const db = this._db;
                for (let i = db.length; i--;)
                {
                    const key = db.key(i);
                    if (key === null) continue;
        
                    if (key.startsWith(keysPrefix) !== true) continue; //check if key is a member of this storage

                    keys.push(key);
                }

                return keys;
            }
            
            const storageTree = this._app.extractOrRethrow(await this.getStructure());
            const thisIDHash = await this.hash(this.id);

            const stack:string[] = [thisIDHash];
            while (stack.length > 0)
            {
                const currentId = stack.pop()!;
                if (storageTree[currentId] === undefined) continue; //can happen, for instance if there are no keys in the storage

                keys.push(...storageTree[currentId].keys);
            }
        
            return keys;
        } 
        catch (error) 
        { 
            return this._app.warn(error, 'Error getting keys', [], {errorOnly:true, names:[BrowserStorage, this._keys]});
        }
    }

    protected override async _has(key:string):Promise<boolean | IError>
    {
        try
        {
            await this.ready();

            return (this._app.extractOrRethrow(await this._get(key, true)) !== undefined);
        }
        catch (error)
        {
            return this._app.warn(error, 'Error checking if key exists', [key], {errorOnly:true, names:[BrowserStorage, this._has]});
        }
    }

    protected override async _remove(keys:Array<string>):Promise<true | IError>;
    protected override async _remove(key:string):Promise<true | IError>;
    protected override async _remove(key:string | Array<string>):Promise<true | IError>
    {
        try 
        { 
            await this.ready();

            if (Array.isArray(key) === true) 
            {
                const hashedKeys = await this.hashKey(key);

                const db = this._db;
                for (const eachKey of hashedKeys) db.removeItem(eachKey);

                return true;
            }
            
            const hashedKey = await this.hashKey(key);

            this._db.removeItem(hashedKey); 
            
            return true;
        }
        catch (error) 
        { 
            return this._app.warn(error, 'Error removing key', [key], {errorOnly:true, names:[BrowserStorage, this._remove]});
        }
    }

    protected override async _clear():Promise<true | IError> //warning: expensive operation if this is not the base storage, but should be fine as this is probably not something we will do very often on a non-base storage anyway. even then, it probably won't be an issue.
    {
        try
        {
            await this.ready();
            
            const db = this._db;

            const thisIDHash = await this.hash(this.id);
            const baseIDHash = await this.hash(this._baseStorageID);

            const thisIsBaseStorage = thisIDHash === baseIDHash;
            if (thisIsBaseStorage === true) //if this is the base storage, we can delete all keys begining with the base storage id hash
            {
                for (let i = db.length; i--;)
                {
                    const key = db.key(i);
                    if (key === null) continue;
        
                    if (key.startsWith(baseIDHash) !== true) continue; //check if key is related to the base storage

                    db.removeItem(key);
                }

                return true;
            }

            const storageTree = this._app.extractOrRethrow(await this.getStructure());

            //delete all keys in the tree starting from this storage
            const stack:string[] = [thisIDHash];
            while (stack.length > 0)
            {
                const currentId = stack.pop()!;
                if (storageTree[currentId] === undefined) continue; //can happen, for instance if there are no keys in the storage

                for (const key of storageTree[currentId].keys) db.removeItem(key);
                
                for (const childId of storageTree[currentId].storages) stack.push(childId);
            }

            return true;
        } 
        catch (error) 
        { 
            return this._app.warn(error, 'Error clearing storage', [], {errorOnly:true, names:[BrowserStorage, this._clear]});
        }
    }

    public async getStructure():Promise<IStorageTree | IError> //warning: expensive operation, but should be fine as it is only likely to be used for clear (which shouldn't be called too often, if ever. _keys, but deep should almost always be false. and for debugging purposes)
    {
        try
        {
            await this.ready();

            const baseIDHash = await this.hash(this._baseStorageID);

            let thisHashedIndexName = this.getHashedIndexName(i_thisStorageID);
            let parentHashedIndexName = this.getHashedIndexName(i_parentStorageID);

            const storageTree:IStorageTree = {};

            const db = this._db;
            for (let i = db.length; i--;)
            {
                const key = db.key(i);
                if (key === null) continue;

                if (key.startsWith(baseIDHash) !== true) continue; //check if key is related to the base storage

                const string = db.getItem(key);
                if (string === null) continue;

                const model = this._app.extractOrRethrow(this._app.serializationUtil.fromString<StorageModel>(string));

                const eachThisIDHash = (model as any)[thisHashedIndexName];
                const eachParentIDHash = (model as any)[parentHashedIndexName];

                if (eachThisIDHash === undefined || eachParentIDHash === undefined) this._app.throw('indexes missing', []);

                //initialize or re-use the relationship object for the current storage ID hash (eachThisIDHash)
                storageTree[eachThisIDHash] = storageTree[eachThisIDHash] ?? {storages:new Set(), keys:[]};

                //initialize or re-use the relationship object for the parent storage ID hash (eachParentIDHash)
                storageTree[eachParentIDHash] = storageTree[eachParentIDHash] ?? {storages:new Set(), keys:[]};

            //add the current storage ID hash as a child to its parent storage ID hash
                storageTree[eachParentIDHash].storages.add(eachThisIDHash);

                //attach the actual storage key to the list of keys under the current storage ID hash
                storageTree[eachThisIDHash].keys.push(key);
            }

            return storageTree;
        }
        catch (error)
        {
            return this._app.warn(error, 'Error getting storage structure', [], {errorOnly:true, names:[BrowserStorage, this.getStructure]});
        }
    }

    protected override async getKeysPrefix():Promise<string>
    {
        const hash = this.hash;
        const promises = new Array(2);
        promises[0] = hash(this._baseStorageID);
        promises[1] = hash(this.id);

        return (await Promise.all(promises)).join('') + "_"; //prepend the base storge id to the key so we can always tell if a key is associated with the base storage (we then know we can decrypt as the cryptokey is shared)
    }
}
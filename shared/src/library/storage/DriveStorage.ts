/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Storage, i_parentStorageID, i_thisStorageID, type StorageModel } from "./Storage.ts";
import type { IStorageTree } from "./IStorage.ts";
import { DataFormat, type IDrive } from "../file/drive/IDrive.ts";
import type { FilePath } from "../file/Path.ts";
import { AbortController } from "../abort/AbortController.ts";
import { IBaseApp, IBaseAppType } from "../IBaseApp.ts";
import { uid } from "../utils/UIDUtil.ts";
import { HKDFKey } from "../utils/KeyUtil.ts";
import { IError } from "../error/IError.ts";
import { __is } from "../utils/__internal/__is.ts";

export class DriveStorage<A extends IBaseApp<A>> extends Storage<A>
{
    private readonly _drive:IDrive<A>;
    private readonly _filePath:FilePath;

    public constructor(app:A, uid:uid, drive:IDrive<A>, filePath:FilePath, cryptoKey?:HKDFKey);
    public constructor(storage:DriveStorage<A>, uid:uid);
    public constructor(...args:any[])
    {
        if (__is<DriveStorage<A>>(args[0], DriveStorage) === true)
        {
            const [storage, uid] = args as [DriveStorage<A>, uid];
            super(storage, uid);

            this._drive = storage._drive;
            this._filePath = storage._filePath;
        }
        else
        {
            const [app, uid, drive, filePath, cryptoKey] = args as [A, uid, IDrive<A>, FilePath, HKDFKey?];

            app.typeUtil.is<A>(app, IBaseAppType) ? super(app, uid, cryptoKey) : super(app, uid);

            this._drive = drive;
            this._filePath = filePath;
        }
    }

    protected override createIndex(_indexName:string):void {}

    protected override async _set<T extends BasicType>(keys:Array<string>, values:Array<T>):Promise<true | IError>;
    protected override async _set<T extends BasicType>(key:string, value:T, json?:Record<string, any>):Promise<true | IError>;
    protected override async _set<T extends BasicType>(key:string | Array<string>, value:T | Array<T>, json?:Record<string, any>):Promise<true | IError>
    {
        try 
        {
            await this.ready();

            const jsonWasUndefined = json === undefined;
            if (json === undefined) 
            {
                json = this._app.extractOrRethrow(await this._drive.getFileData<JsonObject>(this._filePath, new AbortController(this._app), DataFormat.JsonObject));
                if (this._app.typeUtil.isAborted(json) === true) this._app.throw('app aborted before write could finish', []); 
            }

            if (Array.isArray(key) === true)
            {
                if (Array.isArray(value) !== true || key.length !== value.length || value.length === 0) this._app.throw('Invalid arguments', []);
    
                const keys = key;
                const values = value;
    
                let success:IError | true = true;
                for (let i = 0, length = keys.length; i < length; i++)
                {
                    const result = await this._set(keys[i], values[i], json);
                    if (result !== true) success = result;
                }
    
                if (success !== true) return success;
    
                const result = this._app.extractOrRethrow(await this._drive.setFileData(this._filePath, json, new AbortController(this._app)));
                if (this._app.typeUtil.isAborted(result) === true) this._app.throw('app aborted before write could finish', []);

                return result;
            }

            const hashedKey = await this.hashKey(key);

            const encryptedKey = await this.encrypt(key);
            const encryptedValue = await this.encrypt(value as T);
    
            const model = await this.addIndexesAndSignature({key:encryptedKey, value:encryptedValue, indexes:[], signature:''});
            const string = this._app.serializationUtil.toString(model);

            json[hashedKey] = string;

            //if the json was undefined, that means we need to set the file data
            if (jsonWasUndefined === true) 
            {
                const result = await this._drive.setFileData(this._filePath, json, new AbortController(this._app));
                if (this._app.typeUtil.isAborted(result) === true) this._app.throw('app aborted before write could finish', []);

                return result;
            }

            return true;
        }
        catch (error) 
        {
            return this._app.warn(error, 'An error occurred while setting data in the storage', arguments, {errorOnly:true, names:[DriveStorage, this._set]});
        }
    }

    protected override _get<T extends BasicType>(key:string, isOkayIfNotExists?:false, json?:Record<string, any>):Promise<T | IError>;
    protected override _get<T extends BasicType>(key:string, isOkayIfNotExists:true, json?:Record<string, any>):Promise<T | undefined | IError>;
    protected override _get<T extends [...BasicType[]]>(keys:Array<string>, isOkayIfNotExists?:false):Promise<{[K in keyof T]: T[K]} | IError>;
    protected override _get<T extends [...BasicType[]]>(keys:Array<string>, isOkayIfNotExists:true):Promise<{[K in keyof T]: T[K] | undefined} | IError>;
    protected override async _get<T extends BasicType | [...BasicType[]]>(key:string | Array<string>, isOkayIfNotExists?:boolean, json?:Record<string, any>)
    {
        try 
        {
            await this.ready();

            if (json === undefined)
            {
                json = this._app.extractOrRethrow(await this._drive.getFileData<Record<string, any>>(this._filePath, new AbortController(this._app), DataFormat.JsonObject));
                if (this._app.typeUtil.isAborted(json) === true) this._app.throw('app aborted before read could finish', []); 
            }
    
            if (Array.isArray(key) === true)
            {
                const keys = key;
                const values:Array<T | undefined | IError> = [];
                for (let i = 0, length = keys.length; i < length; i++) values[i] = this._app.extractOrRethrow(await this._get<T>(keys[i], isOkayIfNotExists as any, json));
                
                return values;
            }

            const hashedKey = await this.hashKey(key);

            const string = json[hashedKey];

            if (string === undefined) return isOkayIfNotExists === true ? undefined : this._app.throw('Key not found', []);
            
            const model = this._app.extractOrRethrow(this._app.serializationUtil.fromString<StorageModel>(string));

            return this._app.extractOrRethrow(await this.decrypt<T>(model.value));
        }
        catch (error) 
        { 
            return this._app.warn(error, 'An error occurred while getting data from the storage', arguments, {errorOnly:true, names:[DriveStorage, this._get]}); 
        }
    }

    public override async find<T extends BasicType | JsonObject | JsonArray>(predicate:(key:string, value:T) => boolean):Promise<Array<T> | IError>
    {
        return super.find(predicate);
    }

    protected override async _find<T extends BasicType | JsonObject | JsonArray>(predicate:(key:string, value:T) => boolean):Promise<Array<T> | IError>
    {
        const app = this._app;

        try
        {
            await this.ready();
            
            const json = app.extractOrRethrow(await this._drive.getFileData<Record<string, any>>(this._filePath, new AbortController(this._app), DataFormat.JsonObject));
            if (app.typeUtil.isAborted(json) === true) return app.throw('app aborted before read could finish', []);

            const prefix = await this.getKeysPrefix();

            const values:Array<T> = [];
            for (const key in json)
            {
                if (key.startsWith(prefix) !== true) continue;

                const string = json[key];
                if (string === undefined) continue;

                const model = app.extractOrRethrow(app.serializationUtil.fromString<StorageModel>(string));
                
                const promises:Promise<string | T | IError>[] = new Array(2);
                promises[0] = this.decrypt<string>(model.key);
                promises[1] = this.decrypt<T>(model.value);

                let results = await Promise.all(promises);
                const decryptedKey = app.extractOrRethrow(results[0]);
                const decryptedValue = app.extractOrRethrow(results[1]);
                
                if (predicate(decryptedKey as string, decryptedValue as T) !== true) continue;

                values.push(decryptedValue as T);
            }

            return values;
        } 
        catch (error) 
        { 
            return app.warn(error, 'An error occurred while finding data in the storage', arguments, {errorOnly:true, names:[DriveStorage, this._find]});
        }
    }

    protected async _keys(deep:boolean=false):Promise<Array<string> | IError> //warning: deep === true is an expensive operation, but should be fine as it is only likely to be used for debugging, or clear (which shouldn't be called too often)
    {
        const app = this._app;

        try
        {        
            await this.ready();
   
            const keys:Array<string> = [];

            const json = app.extractOrRethrow(await this._drive.getFileData<Record<string, any>>(this._filePath, new AbortController(app), DataFormat.JsonObject));
            if (app.typeUtil.isAborted(json) === true) return app.throw('app aborted before read could finish', []);

            if (deep === false) 
            {
                const keysPrefix = await this.getKeysPrefix();
                for (const key in json)
                {
                    if (key.startsWith(keysPrefix) !== true) continue; //check if key is a member of this storage

                    keys.push(key);
                }

                return keys;
            }
            
            const storageTree = app.extractOrRethrow(await this.#_getStructure(json));
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
            return app.warn(error, 'An error occurred while getting keys from the storage', arguments, {errorOnly:true, names:[DriveStorage, this._keys]}); 
        }
    }

    protected override async _has(key:string):Promise<boolean | IError>
    {
        const app = this._app;

        try
        {
            await this.ready();

            let json = app.extractOrRethrow(await this._drive.getFileData<Record<string, any>>(this._filePath, new AbortController(this._app), DataFormat.JsonObject));
            if (app.typeUtil.isAborted(json) === true) return app.throw('app aborted before read could finish', []); 
    
            const hashedKey = await this.hashKey(key);

            const string = json[hashedKey];

            return string !== undefined;
        }
        catch(error) 
        { 
            return app.warn(error, 'An error occurred while checking if a key exists in the storage', arguments, {errorOnly:true, names:[DriveStorage, this._has]}); 
        }
    }

    protected override async _remove(keys:Array<string>):Promise<true | IError>;
    protected override async _remove(key:string):Promise<true | IError>;
    protected override async _remove(key:string | Array<string>):Promise<true | IError>
    {
        const app = this._app;

        try 
        {        
            await this.ready();
 
            const json = app.extractOrRethrow(await this._drive.getFileData<JsonObject>(this._filePath, new AbortController(this._app), DataFormat.JsonObject));
            if (app.typeUtil.isAborted(json) === true) return app.throw('app aborted before read could finish', []);

            if (Array.isArray(key) === true) 
            {
                const hashedKeys = await this.hashKey(key);

                for (const eachKey of hashedKeys) delete json[eachKey];

                const result = app.extractOrRethrow(await this._drive.setFileData(this._filePath, json, new AbortController(this._app)));
                if (app.typeUtil.isAborted(result) === true) return app.throw('app aborted before write could finish', []);

                return result;
            }
            
            const hashedKey = await this.hashKey(key);

            delete json[hashedKey]; 
            
            const result = app.extractOrRethrow(await this._drive.setFileData(this._filePath, json, new AbortController(this._app)));
            if (app.typeUtil.isAborted(result) === true) return app.throw('app aborted before write could finish', []);

            return result;
        }
        catch(error) 
        { 
            return app.warn(error, 'An error occurred while removing data from the storage', arguments, {errorOnly:true, names:[DriveStorage, this._remove]});
        }
    }

    protected override async _clear():Promise<true | IError> //warning: expensive operation if this is not the base storage, but should be fine as this is probably not something we will do very often on a non-base storage anyway. even then, it probably won't be an issue.
    {
        const app = this._app;

        try
        {
            await this.ready();
            
            const thisIDHash = await this.hash(this.id);
            const baseIDHash = await this.hash(this._baseStorageID);

            const json = app.extractOrRethrow(await this._drive.getFileData<JsonObject>(this._filePath, new AbortController(app), DataFormat.JsonObject));
            if (app.typeUtil.isAborted(json) === true) return app.throw('app aborted before read could finish', []);

            const thisIsBaseStorage = thisIDHash === baseIDHash;
            if (thisIsBaseStorage === true) //if this is the base storage, we can delete all keys begining with the base storage id hash
            {
                for (const key in json)
                {
                    if (key.startsWith(baseIDHash) !== true) continue; //check if key is related to the base storage

                    delete json[key];
                }

                const result = app.extractOrRethrow(await this._drive.setFileData(this._filePath, json, new AbortController(app)));
                if (app.typeUtil.isAborted(result) === true) return app.throw('app aborted before write could finish', []);

                return result;
            }

            const storageTree = app.extractOrRethrow(await this.#_getStructure(json));

            //delete all keys in the tree starting from this storage
            const stack:string[] = [thisIDHash];
            while (stack.length > 0)
            {
                const currentId = stack.pop()!;
                if (storageTree[currentId] === undefined) continue; //can happen, for instance if there are no keys in the storage

                for (const key of storageTree[currentId].keys) delete json[key];
                
                for (const childId of storageTree[currentId].storages) stack.push(childId);
            }

            const result = app.extractOrRethrow(await this._drive.setFileData(this._filePath, json, new AbortController(app)));
            if (app.typeUtil.isAborted(result) === true) return app.throw('app aborted before write could finish', []);

            return result;
        } 
        catch(error) 
        { 
            return app.warn(error, 'An error occurred while clearing the storage', arguments, {errorOnly:true, names:[DriveStorage, this._clear]}); 
        }
    }

    public async getStructure():Promise<IStorageTree | IError> { return this.#_getStructure(); }

    async #_getStructure(json?:Record<string, any>):Promise<IStorageTree | IError> //warning: expensive operation, but should be fine as it is only likely to be used for clear (which shouldn't be called too often, if ever. _keys, but deep should almost always be false. and for debugging purposes)
    {
        const app = this._app;

        try
        {
            const baseIDHash = await this.hash(this._baseStorageID);

            let thisHashedIndexName = this.getHashedIndexName(i_thisStorageID);
            let parentHashedIndexName = this.getHashedIndexName(i_parentStorageID);

            const storageTree:IStorageTree = {};

            if (json === undefined)
            {
                json = app.extractOrRethrow(await this._drive.getFileData<Record<string, any>>(this._filePath, new AbortController(app), DataFormat.JsonObject));
                if (app.typeUtil.isAborted(json) === true) return app.throw('app aborted before read could finish', []);
            }

            for (const key in json)
            {
                if (key.startsWith(baseIDHash) !== true) continue; //check if key is related to the base storage

                const string = json[key];
                if (string === undefined) continue;

                const model = app.extractOrRethrow(this._app.serializationUtil.fromString<StorageModel>(string));

                const eachThisIDHash = (model as any)[thisHashedIndexName];
                const eachParentIDHash = (model as any)[parentHashedIndexName];

                if (eachThisIDHash === undefined || eachParentIDHash === undefined) app.throw('indexes missing', []);

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
        catch(error) 
        { 
            return app.warn(error, 'An error occurred while getting the storage structure', arguments, {errorOnly:true, names:[DriveStorage, this.#_getStructure]}); 
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
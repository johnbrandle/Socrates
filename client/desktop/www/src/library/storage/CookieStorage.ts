/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp.ts";
import { BrowserStorage } from "./BrowserStorage.ts";
import type { HKDFKey } from "../utils/KeyUtil.ts";
import type { uid } from "../utils/UIDUtil.ts";
import type { IError } from "../../../../../../shared/src/library/error/IError.ts";

export class CookieStorage<A extends IBaseApp<A>> extends BrowserStorage<A>
{
    private static _cookieDB:CookieDB | undefined;

    public constructor(storage:CookieStorage<A>, uid:uid);
    public constructor(app:A, uid:uid, cryptoKey?:HKDFKey);
    public constructor(...args:any[])
    {
        const db = CookieStorage._cookieDB ?? (CookieStorage._cookieDB = new CookieDB());

        if (args.length === 2)
        {
            const [storage, uid] = args as [CookieStorage<A>, uid];
            super(db, storage, uid);
        }
        else
        {
            const [app, uid, cryptoKey] = args as [A, uid, HKDFKey?];
            super(db, app, uid, cryptoKey);
        }
    }

    protected override async _set<T extends BasicType>(key:string, value:T, days?:number):Promise<true | IError>;
    protected override async _set<T extends BasicType>(keys:Array<string>, values:Array<T>, days?:number):Promise<true | IError>;
    protected override async _set<T extends BasicType>(key:string | Array<string>, value:T | Array<T>, days:number=0):Promise<true | IError>
    {
        try
        {
            await this.ready();

            if (Array.isArray(key) === true)
            {
                if (Array.isArray(value) !== true || key.length !== value.length || value.length === 0) this._app.throw('invalid arguments', []);

                const keys = key;
                const values = value;

                for (let i = 0, length = keys.length; i < length; i++) this._app.extractOrRethrow(await this._set(keys[i], values[i], days));
                
                return true;
            }

            const hashedKey = await this.hashKey(key);

            const encryptedKey = this._app.extractOrRethrow(await this.encrypt(key));

            const encryptedValue = this._app.extractOrRethrow(await this.encrypt(value as T));
    
            const model = await this.addIndexesAndSignature({key:encryptedKey, value:encryptedValue, indexes:[], signature:''});
            const string = this._app.serializationUtil.toString(model);

            (this._db as CookieDB).setItem(hashedKey, string, days);
            
            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to set value', [key, value], {errorOnly:true, names:[this.constructor, this._set]});
        }
    }
}

class CookieDB
{
    private _invalidated = true;

    private _cookies:Map<string, string | undefined> = new Map();
    private _keys:Array<string> = [];

    public constructor()
    {
    }

    public setItem(key:string, value:string, days:number=0):void
    {
        if (this._invalidated === true) this.#refresh();

        if (this._cookies.has(key) !== true) this._invalidated = true;

        let cookie = key + '=' + value;

        if (days) 
        {
            const date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            cookie += '; SameSite=Strict; secure; expires=' + date.toUTCString();
        }

        document.cookie = cookie + ';path=/';
    }

    public getItem(key:string):string | null
    {
        if (this._invalidated === true) this.#refresh();

        return this._cookies.get(key) ?? null;
    }

    public removeItem(key:string):void
    {
        if (this._invalidated === true) this.#refresh();

        if (this._cookies.has(key) === true) this._invalidated = true;

        document.cookie = key + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }

    public get length():number
    {
        if (this._invalidated === true) this.#refresh();

        return this._cookies.size;
    }

    public key(index:number):string | null
    {
        if (this._invalidated === true) this.#refresh();

        return this._keys[index] ?? null;
    }

    #refresh()
    {
        if (this._invalidated !== true) return;

        this._cookies.clear();

        const cookies = document.cookie.split(';');
        for (let cookie of cookies) 
        {
            cookie.trim();

            const eqPos = cookie.indexOf('=');
            const key = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
            const value = eqPos > -1 ? cookie.substring(eqPos + 1, cookie.length) : undefined;

            this._cookies.set(key, value);
            this._keys.push(key);
        }

        this._invalidated = false;
    }
}
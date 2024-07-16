/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../IApp.ts";
import { Model } from "../../../../../../shared/src/library/model/Model.ts";
import * as UserJSON from '../../../../../../shared/src/app/json/UserJSON.ts';
import type { IStorage } from "../../../../../../shared/src/library/storage/IStorage.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { Signal } from "../../../../../../shared/src/library/signal/Signal.ts";
import type { IError } from "../../../../../../shared/src/library/error/IError.ts";

export class UserModel<A extends IApp<A>> extends Model<A>
{
    private _storage?:IStorage<A>;
    private _userJSON?:UserJSON.UserJSON;
    
    private _loggedIn = false;
    private _loggedInOffline = false;
    
    public readonly onLoginSignal:Signal<[UserModel<A>, boolean]> = new Signal<[UserModel<A>, boolean]>(this);

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    public async onLogin(storage:IStorage<A>, loggedInOffline:boolean, userJSON:UserJSON.UserJSON)
    {
        this._storage = storage;
        this._loggedInOffline = loggedInOffline;
        this._userJSON = userJSON;

        this._loggedIn = true;

        this.onLoginSignal.dispatch(this, true);
    }

    public onLogout()
    {
        this._storage = undefined;
        this._loggedInOffline = false;
        this._userJSON = undefined;

        this._loggedIn = false;

        this.onLoginSignal.dispatch(this, false);
    }

    public get loggedIn():boolean
    {
        return this._loggedIn;
    }

    public get loggedInOffline():boolean //if they are logged in, this indicates if they are logged in online or offline
    {
        return this._loggedInOffline;
    }

    public setWalletID(id:string):Promise<true | IError>
    {
        if (this._storage === undefined) this._app.throw('storage is undefined', []);
        
        return this._storage.set('WALLET_ID', id);
    }

    public getWalletID():Promise<string | IError>
    {
        if (this._storage === undefined) this._app.throw('storage is undefined', []);
        
        return this._storage.get<string>('WALLET_ID');
    }
}
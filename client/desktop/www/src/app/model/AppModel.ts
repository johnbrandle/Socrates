/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Model } from '../../../../../../shared/src/library/model/Model.ts';
import type { IApp } from '../IApp.ts';
import type { IStorage } from '../../../../../../shared/src/library/storage/IStorage.ts';
import type { IDestructor } from '../../../../../../shared/src/library/IDestructor.ts';

/**
 * The app model is for storing state that changes (and may or may not need to be persisted), before a user is logged in (so it should have no user specific data)
 * 
 * @important This should not store any sensitive data, as it is not meant to be encrypted
 * 
 * Example: should application close to tray
 */
export class AppModel<A extends IApp<A>> extends Model<A> 
{
    private _storage!:IStorage;

    private _preferences!:Record<string, any>;

    constructor(app:A, destructor:IDestructor<A>) 
    {
        super(app, destructor);
    }

    public async init(storage:IStorage):Promise<AppModel<A>>
    {
        this._storage = storage;
        this._preferences = JSON.parse((await storage.get('preferences', true)) ?? '{}');

        return this;
    }

    async #savePreferences():Promise<void>
    {
        this._storage.set('preferences', JSON.stringify(this._preferences));
    }

    public override async dnit(): Promise<boolean>
    {
        if (await this.dnit() !== true) return false;
        
        await this.#savePreferences();

        return true;
    }
}
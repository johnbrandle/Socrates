/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";
import { HKDFKey, Salt, salt } from "./KeyUtil";
import { type uid } from "./UIDUtil";

const uuidRegex:RegExp = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

export type uuid = string & { _brand: 'uuid' };

@SealedDecorator()
export class UUIDUtil<A extends IBaseApp<A>>
{    
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Checks if a string is a valid UUID.
     * 
     * @param uuid - The string to check.
     * @returns Whether the string is a valid UUID.
     */
    public is(uuid:string):boolean { return uuidRegex.test(uuid) };

    /**
     * Generates a deterministic UUID based on two strings using HMAC.
     * (input uuid + salt must be unique)
     * 
     * @note effective entropy up to ~122 bits
     * 
     * @param uuid - An existing UUID.
     * @param salt - A random string.
     * @returns A new deterministic UUID.
     */
    public async derive(uuid:uuid | uid, salt:string):Promise<uuid>
    {
        //check if it is a uuid. if so, convert it to a uid by removing the dashes to get 16 bytes, and repeating the result twice to get 32 bytes
        if (uuid.indexOf('-') !== -1) uuid = uuid.replace(/-/g, '').repeat(2) as uid;

        return this.to(await this._app.uidUtil.derive(uuid as uid, salt));
    }

    public async deriveFromHKDFKey(hkdfKey:HKDFKey, salt:salt | Salt):Promise<uuid> { return this.to(await this._app.uidUtil.deriveFromHKDFKey(hkdfKey, salt)); }

    public generate():uuid { return crypto.randomUUID() as uuid; }
      
    public to(uid:uid):uuid
    {
        const newUUID = 
        [
            uid.slice(0, 8),
            uid.slice(8, 12),
            '4' + uid.slice(12, 15),  //UUID version 4
            ['8', '9', 'a', 'b'][parseInt(uid.slice(16, 17), 16) % 4] + uid.slice(17, 20),  //UUID variant
            uid.slice(20, 32),
        ].join('-');

        return newUUID as uuid;
    }
}
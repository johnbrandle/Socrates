/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @important ALL changes to this util and dependant utils must be well tested!
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { HKDFKey, Salt, salt } from "./KeyUtil";
import { HashOutputFormat, HashType, hex_256 } from "./HashUtil";
import { IBaseApp } from "../IBaseApp";

const uidRegex:RegExp = /^[0-9a-fA-F]{64}$/;

export type uid = hex_256 & {_uidBrand:'uid'};

@SealedDecorator()
export class UIDUtil<A extends IBaseApp<A>>
{    
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Checks if a string is a valid UID.
     * 
     * @param uid - The string to check.
     * @returns Whether the string is a valid UID.
     */
    public is(uid:string):boolean { return uidRegex.test(uid) };

    /**
     * Generates a deterministic UID based on two strings using HMAC.
     * (input uid + salt must be unique)
     * 
     * @note effective entropy up to 256 bits 
     * 
     * @param uid - An existing UID.
     * @param string - A random string.
     * @returns A new deterministic UID.
     */
    public async derive(uid:uid, string:string):Promise<uid>
    {
        if (string.length < 1) this._app.throw('cannot generate UID with an empty salt.', [], {correctable:true});

        return await this._app.hashUtil.derive(this._app.hashUtil.encodeData([uid, this._app.textUtil.toUint8Array(string.normalize('NFKC'))]), HashType.SHA_256, HashOutputFormat.hex) as uid;
    }

    public async deriveFromHKDFKey(hkdfKey:HKDFKey, salt:salt | Salt):Promise<uid>
    {
        return this._app.baseUtil.toHex<uid>(await this._app.byteUtil.derive(hkdfKey, salt, 32));
    }

    /**
     * Generates a cryptographically secure uid.
     * @returns A cryptographically secure uid.
     */
    public generate():uid { return this._app.baseUtil.toHex<uid>(this._app.byteUtil.generate(32)); };
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { UUIDUtil as Shared, type uuid } from '../../../../../../shared/src/library/utils/UUIDUtil.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import { type uid } from './UIDUtil.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export * from '../../../../../../shared/src/library/utils/UUIDUtil.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class UUIDUtil<A extends IBaseApp<A>> extends Shared<A>
{
    /**
     * Derives a deterministic UUID based on two strings using HMAC.
     * (input uuid + salt must be unique)
     * 
     * @note effective entropy up to ~122 bits
     * 
     * @param uuid - An existing UUID.
     * @param string - A random string.
     * @returns A new deterministic UUID.
     */
    public override derive(uuid:uuid | uid, string:string, sync:true):uuid;
    public override derive(uuid:uuid | uid, string:string):Promise<uuid>;
    public override derive(uuid:uuid | uid, string:string, sync?:boolean)
    {
        if (sync !== true) return super.derive(uuid, string);

        //check if it is a uuid. if so, convert it to a uid by removing the dashes to get 16 bytes, and repeating the result twice to get 32 bytes
        if (uuid.indexOf('-') !== -1) uuid = uuid.replace(/-/g, '').repeat(2) as uid;

        //generate an HMAC of the combined string
        const uid = this._app.uidUtil.derive(uuid as uid, string, sync);
        
        //extract parts of the hash to make up a new UUID
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
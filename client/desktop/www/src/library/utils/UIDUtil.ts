/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { UIDUtil as Shared, type uid } from '../../../../../../shared/src/library/utils/UIDUtil.ts';
import { HashOutputFormat, HashType } from './HashUtil.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export * from '../../../../../../shared/src/library/utils/UIDUtil.ts';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class UIDUtil<A extends IBaseApp<A>> extends Shared<A>
{
    public constructor(app:A)
    {
        super(app);
    }

    /**
     * Derives a deterministic UID based on two strings using HMAC.
     * (input uid + salt must be unique)
     * 
     * @note effective entropy up to 256 bits 
     * 
     * @param uid - An existing UID.
     * @param string - A random string.
     * @returns A new deterministic UID.
     */
    public override derive(uid:uid, string:string, sync:true):uid;
    public override derive(uid:uid, string:string):Promise<uid>;
    public override derive(uid:uid, string:string, sync?:boolean)
    {
        if (sync !== true) return super.derive(uid, string);

        const app = this._app;

        if (string.length < 1) app.throw('cannot generate uid without a string.', []);

        return app.hashUtil.derive(app.hashUtil.encodeData([uid, app.textUtil.toUint8Array(string.normalize('NFKC'))]), HashType.SHA_256, HashOutputFormat.hex, true) as uid;
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp.ts";
import type { HKDFKey } from "../utils/KeyUtil.ts";
import type { uid } from "../utils/UIDUtil.ts";
import { BrowserStorage } from "./BrowserStorage.ts";

export class LocalStorage<A extends IBaseApp<A>> extends BrowserStorage<A>
{
    public constructor(app:A, uid:uid, cryptoKey?:HKDFKey);
    public constructor(storage:LocalStorage<A>, uid:uid);
    public constructor(...args:any[])
    {
        if (args.length === 2)
        {
            const [storage, uid] = args as [LocalStorage<A>, uid];
            super(window.localStorage, storage, uid);
        }
        else
        {
            const [app, uid, cryptoKey] = args as [A, uid, HKDFKey?];
            super(window.localStorage, app, uid, cryptoKey);
        }
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { HKDFKey } from "../utils/KeyUtil.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import { BrowserStorage } from "./BrowserStorage.ts";
import type { uid } from "../utils/UIDUtil.ts";

export class SessionStorage<A extends IBaseApp<A>> extends BrowserStorage<A>
{
    public constructor(app:A, uid:uid, cryptoKey?:HKDFKey);
    public constructor(storage:SessionStorage<A>, uid:uid);
    public constructor(...args:any[])
    {
        if (args.length === 2)
        {
            const [storage, uid] = args as [SessionStorage<A>, uid];
            super(window.sessionStorage, storage, uid);
        }
        else
        {
            const [app, uid, cryptoKey] = args as [A, uid, HKDFKey?];
            super(window.sessionStorage, app, uid, cryptoKey);
        }
    }
}

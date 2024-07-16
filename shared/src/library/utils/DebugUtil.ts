/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator.ts";
import { IBaseApp } from "../IBaseApp.ts";
import { __format } from './__internal/__format.ts';

@SealedDecorator()
export class DebugUtil<A extends IBaseApp<A>> 
{
    protected _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public get isDebug():boolean { return globalThis.environment.frozen.isDebug; }

    public format = __format;
}
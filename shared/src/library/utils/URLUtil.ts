/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";

@SealedDecorator()
export class URLUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public getNormalizedPathname(url:string):string
    {
        const pathname = new URL(url).pathname.toLowerCase();
        return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname; //remove end / if there is one
    }
}
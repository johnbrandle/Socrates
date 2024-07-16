/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../../../../../shared/src/library/decorators/SealedDecorator";
import type { IBaseApp } from "../IBaseApp";

@SealedDecorator()
export class AccessUtil<A extends IBaseApp<A>> 
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Check if a property is valid to access. (not a constructor, prototype, or __proto__)
     * 
     * @param scope - the object to check the property against
     * @param prop - the property to check
     * @returns true if the property is valid to access
     */
    public isValidPropAccess(scope:any, prop:string):boolean
    {
        return prop in scope === true && prop !== 'constructor' && prop !== 'prototype' && prop !== '__proto__';
    }
}
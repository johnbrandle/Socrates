/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "./IAbortable";
import { IBaseApp } from "../IBaseApp";
import { IAborted } from "./IAborted";
import { AbortableHelper } from "../helpers/AbortableHelper";

export const IAbortControllerType = Symbol("IAbortController");

export interface IAbortController<A extends IBaseApp<A>, R=any> extends IAbortable<R>
{
    /**
     * Checks if the provided value should trigger an abort.
     * @param value - The value to check.
     * @returns True if the value should trigger an abort, false otherwise.
     */
    check(value?:any):boolean;

    abort(reason:string, result?:R):IAborted<R>;

    get abortableHelper():AbortableHelper<A>;
}

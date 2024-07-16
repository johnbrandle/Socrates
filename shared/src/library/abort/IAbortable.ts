/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IWeakSignal } from "../signal/IWeakSIgnal";

export const IAbortableType = Symbol("IAbortable");

export interface IAbortable<R=any>
{
    get onAbortedSignal():IWeakSignal<[IAbortable<R>, string, R | undefined]>;
    get aborted():boolean;
    
    get reason():string;
    get result():R | undefined;

    get signal():AbortSignal;

    addAbortable(abortable:IAbortable):void;
}

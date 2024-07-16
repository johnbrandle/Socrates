/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import type { IIdentifiable } from "../IIdentifiable";
import { IWeakSignal } from "../signal/IWeakSIgnal";

export const ICollectionType = Symbol("ICollection");

export interface ICollection<A extends IBaseApp<A>, T extends IIdentifiable>
{
    [Symbol.iterator](startIndex:number, endIndex?:number, options?:{consistencyMode?:0|1}):Generator<T, void, undefined>; 
    values(startIndex:number, endIndex?:number, options?:{consistencyMode?:0|1}):Generator<T, void, undefined>; 
    get size():number;

    get(id:string):T | undefined;

    get onInvalidatedSignal():IWeakSignal<[ICollection<A, T>]>;
}
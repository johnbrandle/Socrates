/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "./IBaseApp";
import type { IDestructable } from "./IDestructable";

export const IDestructorType = Symbol("IDestructor");

export interface IDestructor<A extends IBaseApp<A>>
{
    addDestructable(destructable:IDestructable<A> | (() => Promise<any>)):void; 
    removeDestructable(destructable:IDestructable<A> | (() => Promise<any>)):boolean;
    get app():A;
}
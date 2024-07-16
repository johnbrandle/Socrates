/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "./IBaseApp";
import type { IDestructor } from "./IDestructor";
import type { IObservable } from "./IObservable";

export const IDestructableType = Symbol("IDestructable");

export const OnDestruct = Symbol("OnDestruct"); //for observers @see IObservable and ObservableManager

export interface IDestructable<A extends IBaseApp<A>> extends IDestructor<A>, IObservable<A>
{
    get destructor():IDestructor<A>;
    
    /**
     * Deinitializes the object.
     * @returns A promise that resolves with a boolean indicating if the component has already been dnited (true if no, false if yes).
     */
    dnit(...args:any):Promise<boolean>;
    dnited:boolean;
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";

export interface IGlobalListenerMap 
{
}

export const IGlobalListenerManagerType = Symbol("IGlobalListenerManager");

export interface IGlobalListenerManager<A extends IBaseApp<A>, L extends IGlobalListenerMap>
{
    subscribe(destructor:IDestructor<A>, eventType:keyof L, handler:L[keyof L]):void;
    subscribed(destructor:IDestructor<A>, eventType:keyof L, handler:L[keyof L]):boolean;
    unsubscribe(destructor:IDestructor<A>, eventType:keyof L, handler?:L[keyof L]):void; 
}
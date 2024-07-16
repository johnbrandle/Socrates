/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";

export interface IGlobalObserverMap 
{
}

export const IGlobalObserverManagerType = Symbol("IGlobalObserverManager");

export interface IGlobalObserverManager<A extends IBaseApp<A>, O extends IGlobalObserverMap>
{
    subscribe(destructor:IDestructor<A>, element:Element, entryType:keyof O, handler:O[keyof O]):void;
    subscribed(element:Element, entryType:keyof O):boolean;

    unsubscribe(element:Element, entryType?:keyof O):void;
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IObservable } from "../IObservable.ts";
import { IBaseApp } from "../IBaseApp.ts";

export const IObservableManagerType = Symbol("IObservableManager");

export interface IObservableManager<A extends IBaseApp<A>>
{
    register(observable:IObservable):void;
    unregister(observable:IObservable):void;
    isRegistered(observable:IObservable):boolean;
}
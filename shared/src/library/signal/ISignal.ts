/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * inspired, but not derived from: https://github.com/robertpenner/as3-signals
 */

import type { IDestructor } from "../IDestructor";
import type { IBaseSignal } from "./IBaseSignal";

export const ISignalType = Symbol("ISignal");

/**
 * Represents a signal that can be subscribed to and triggered with arguments of type T.
 * @template T - The types of the arguments that the signal will receive.
 */
export interface ISignal<T extends any[], R=any> extends IBaseSignal<T, R>
{
    subscribe(destructor:IDestructor<any>, f:(...args:T) => R, options?:{once?:boolean}):void;
    subscribe(f:(...args:T) => R, options:{once?:boolean, weak:true, warnIfCollected?:boolean}):void;
    subscribe(f:(...args:T) => R, options?:{once?:boolean, weak?:boolean}):void;

    unsubscribe(destructor:IDestructor<any>):void;
    unsubscribe(f:(...args:T) => R):void;

    subscribed(destructor:IDestructor<any>):boolean;
    subscribed(f:(...args: T) => R):boolean;
}
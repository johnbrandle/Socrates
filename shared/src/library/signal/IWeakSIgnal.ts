/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * inspired, but not derived from: https://github.com/robertpenner/as3-signals
 */

import { IDestructor } from "../IDestructor";
import type { IObservable } from "../IObservable";
import type { IBaseSignal } from "./IBaseSignal";

export const IWeakSignalType = Symbol("IWeakSignal");

/**
 * Represents a signal that can be subscribed to and triggered with arguments of type T.
 * @template T - The types of the arguments that the signal will receive.
 * 
 * subscribers are always held by weak references
 * 
 * Note: failure to properly unsubscribe subscribers will generate a warning.
 */
export interface IWeakSignal<T extends any[], R=any> extends IBaseSignal<T, R>
{
    /**
     * Subscribes a subscriber function to the signal.
     * @param scope - The scope to bind the subscriber function to.
     * @param f - The subscriber function to add. (must be a function property of the scope)
     * @param once - If true, the subscriber will be removed after the first time it is called.
     * 
     * Note: failure to properly unsubscribe subscribers will generate a warning.
     */
    
    //it may be necessary to hold references strongly in some cases
    subscribe(scope:IObservable<any>, f:(...args:T) => R, options?:{once?:boolean, warnIfCollected?:boolean}):void;
    subscribe(destructor:IDestructor<any>, f:(...args:T) => R, options:{once?:boolean, weak:false}):void;
    subscribe(f:(...args:T) => R, options:{once?:boolean, weak:false}):void;
    subscribe(f:(...args:T) => R, options?:{once?:boolean, warnIfCollected?:boolean}):void;
    
    unsubscribe(scope:IObservable<any>):void;
    unsubscribe(f:(...args: T) => R):void;

    subscribed(scope:IObservable<any>):boolean;
    subscribed(f:(...args:T) => R):boolean;
}
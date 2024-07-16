/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * inspired, but not derived from: https://github.com/robertpenner/as3-signals
 */

export const IBaseSignalType = Symbol("IBaseSignal");

/**
 * Represents a signal that can be subscribed to and triggered with arguments of type T.
 * @template T - The types of the arguments that the signal will receive.
 */
export interface IBaseSignal<T extends any[], R=any> 
{
    /**
     * Removes all subscribers from the signal.
     */
    clear():void;

    /**
     * Dispatches the signal to all connected subscribers with the given arguments.
     * 
     * @param args - The arguments to pass to the subscribers.
     */
    dispatch(...args:T):R;

    /**
     * The number of subscribers currently registered to this signal.
     */
    get subscribers():number;
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * inspired, but not derived from: https://github.com/robertpenner/as3-signals
 */

import type { ISignal } from './ISignal.ts';
import { ISignalType } from './ISignal.ts';
import { BaseSignal } from './BaseSignal.ts';
import { IDestructorType, type IDestructor } from '../IDestructor.ts';
import { ImplementsDecorator } from '../decorators/ImplementsDecorator.ts';

@ImplementsDecorator(ISignalType)
export class Signal<T extends any[], R=any> extends BaseSignal<T, R> implements ISignal<T, R>
{
    constructor(destructor:IDestructor<any>)
    {
        super(destructor.app, destructor);
    }

    public subscribe(destructor:IDestructor<any>, f:(...args:T) => R, options?:{once?:boolean}):void;
    public subscribe(f:(...args:T) => R, options:{once?:boolean, weak:true, warnIfCollected?:boolean}):void;
    public subscribe(f:(...args:T) => R, options?:{once?:boolean, weak?:boolean}):void;
    public subscribe(...args:any[]):void
    {
        if (this._app.typeUtil.isFunction(args[0]) === true) 
        {
            let [f, options] = args;

            if (options === undefined) options = {};
            if (options.weak === undefined) options.weak = false;
            if (options.warnIfCollected === undefined) options.warnIfCollected = true;

            return super._subscribe(f, options);
        }

        let [destructor, f, options] = args;

        if (options === undefined) options = {};
        if (options.weak === undefined) options.weak = false;
        if (options.warnIfCollected === undefined) options.warnIfCollected = true;

        return super._subscribe(destructor, f, options);
    }
    
    public unsubscribe(destructor:IDestructor<any>):void;
    public unsubscribe(f:(...args: T) => R):void;
    public unsubscribe(arg:unknown):void
    {
        return (this._app.typeUtil.is<IDestructor<any>>(arg, IDestructorType)) ? super.__unsubscribe(arg) : super.__unsubscribe(arg as (...args:T) => R);
    }

    public subscribed(destructor:IDestructor<any>):boolean;
    public subscribed(f:(...args: T) => R):boolean;
    public subscribed(arg:unknown)
    {
        return (this._app.typeUtil.is<IDestructor<any>>(arg, IDestructorType)) ? super.__subscribed(arg) : super.__subscribed(arg as (...args:T) => R);
    }
}
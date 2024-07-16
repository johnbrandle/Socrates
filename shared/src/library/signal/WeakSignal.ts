/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * inspired, but not derived from: https://github.com/robertpenner/as3-signals
 */

import { ImplementsDecorator } from '../decorators/ImplementsDecorator.ts';
import { IBaseApp } from '../IBaseApp.ts';
import type { IDestructor } from '../IDestructor.ts';
import type { IObservable } from '../IObservable.ts';
import { BaseSignal } from './BaseSignal.ts';
import type { IWeakSignal } from './IWeakSIgnal.ts';
import { IWeakSignalType } from './IWeakSIgnal.ts';

@ImplementsDecorator(IWeakSignalType)
export class WeakSignal<T extends any[], R=any> extends BaseSignal<T, R> implements IWeakSignal<T, R>
{
    constructor(app:IBaseApp<any>, destructor?:IDestructor<any>)
    {
        super(app, destructor);
    }

    public subscribe(scope:IObservable<any>, f:(...args:T) => R, options?:{once?:boolean, warnIfCollected?:boolean}):void;
    public subscribe(destructor:IDestructor<any>, f:(...args:T) => R, options:{once?:boolean, weak:false}):void;
    public subscribe(f:(...args:T) => R, options:{once?:boolean, weak:false}):void;
    public subscribe(f:(...args:T) => R, options?:{once?:boolean, warnIfCollected?:boolean}):void;
    public subscribe(...args:any[]):void
    { 
        if (this._app.typeUtil.isFunction(args[0]) === true) 
        {
            let [f, options] = args;

            if (options === undefined) options = {};
            if (options.weak === undefined) options.weak = true;
            if (options.warnIfCollected === undefined) options.warnIfCollected = true;

            return super._subscribe(f, options);
        }

        let [scope, f, options] = args;

        if (options === undefined) options = {};
        if (options.weak === undefined) options.weak = true;
        if (options.warnIfCollected === undefined) options.warnIfCollected = true;

        return super._subscribe(scope, f, options);
    }

    public unsubscribe(scope:IObservable<any>):void;
    public unsubscribe(f:(...args:T) => R):void;
    public unsubscribe(arg:unknown):void
    {
        return (arg instanceof Function) ? super.__unsubscribe(arg as (...args:T) => R) : super.__unsubscribe(arg as IObservable<any>);
    }

    public subscribed(scope:IObservable<any>):boolean;
    public subscribed(f:(...args:T) => R):boolean;
    public subscribed(arg:unknown)
    {
        return (arg instanceof Function) ? super.__subscribed(arg as (...args:T) => R) : super.__subscribed(arg as IObservable<any>);
    }
}
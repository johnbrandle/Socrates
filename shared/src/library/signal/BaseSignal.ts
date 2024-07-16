/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * inspired, but not derived from: https://github.com/robertpenner/as3-signals
 */

import { ImplementsDecorator } from '../decorators/ImplementsDecorator.ts';
import { IBaseApp } from '../IBaseApp.ts';
import { IDestructorType, type IDestructor } from '../IDestructor.ts';
import type { IObservable } from '../IObservable.ts';
import type { IBaseSignal } from './IBaseSignal.ts';
import { IBaseSignalType } from './IBaseSignal.ts';

interface ISubscriber<T extends any[], R>
{
    scope?:WeakRef<WeakKey> | undefined;
    f:WeakRef<(...args:T) => R> | ((...args:T) => R);
    once:boolean;
    warnIfCollected:boolean;

    destructor?:IDestructor<any>;
    destructorFunc?:() => Promise<any>;
}

const isMethodOf = (obj:Object, func:Function):boolean =>
{
    let currentObj = obj;
    
    //check the object and its prototype chain
    while (currentObj !== undefined) 
    {
        const properties = Object.getOwnPropertyNames(currentObj);
        
        for (const property of properties) 
        {
            const value = Object.getOwnPropertyDescriptor(currentObj, property)?.value;
            if (value === func) return true;
        }

        currentObj = Object.getPrototypeOf(currentObj) ?? undefined;
    }
    
    return false;
}

@ImplementsDecorator(IBaseSignalType)
export abstract class BaseSignal<T extends any[], R=any> implements IBaseSignal<T, R>
{
    protected _app:IBaseApp<any>;

    private readonly _subscribers:Array<ISubscriber<T, R>> = []; //holds the registered subscribers
 
    private _dnited = false;

    constructor(app:IBaseApp<any>, destructor?:IDestructor<any>)
    {
        this._app = app;

        destructor?.addDestructable(async () => 
        {
            this._dnited = true;

            this.clear();
        });
    }
    
    protected _subscribe(f:(...args:T) => R, options?:{once?:boolean, weak?:boolean, warnIfCollected?:boolean}):void;
    protected _subscribe(scope:IObservable<any>, f:(...args:T) => R, options?:{once?:boolean, weak?:boolean, warnIfCollected?:boolean}):void;
    protected _subscribe(destructor:IDestructor<any>, f:(...args:T) => R, options?:{once?:boolean}):void;
    protected _subscribe(...args:any[]):void
    {
        if (this._dnited === true) 
        {
            this._app.consoleUtil.warn(this.constructor, 'attempted to subscribe after signal was destructed.');
            return;
        }

        const verify = (f:Function, scope?:WeakKey | undefined):boolean => //verify the function is not already subscribed
        {
            for (const subscriber of this._subscribers) 
            {
                let eachFunc;
                if (subscriber.f instanceof WeakRef)
                {
                    eachFunc = subscriber.f.deref();
                    if (eachFunc === undefined)
                    {
                        if (subscriber.warnIfCollected === true) this._app.consoleUtil.warn(this.constructor, 'weak signal subscriber was already garbage collected. Please ensure that you are not using anonymous functions as weak signal subscribers and/or that you are properly unsubscribing from signals.');
                        continue;
                    }
                }
                else eachFunc = subscriber.f;

                let eachScope;
                if (subscriber.scope instanceof WeakRef)
                {
                    eachScope = subscriber.scope.deref();
                    if (eachScope === undefined)
                    {
                        if (subscriber.warnIfCollected === true) this._app.consoleUtil.warn(this.constructor, 'weak signal subscriber was already garbage collected. Please ensure that you are not using anonymous functions as weak signal subscribers and/or that you are properly unsubscribing from signals.');
                        continue;
                    }
                }
                else eachScope = subscriber.scope;

                if (eachFunc !== f || eachScope !== scope) continue;

                this._app.consoleUtil.warn(this.constructor, 'attempted to subscribe a function that was already subscribed to this signal.');
                return false;
            }

            return true;
        }

        if (this._app.typeUtil.isFunction(args[0]) === true)
        {
            const f = args[0];
            const options = args[1] as {once?:boolean, weak?:boolean, warnIfCollected?:boolean} | undefined;

            if (verify(f) !== true) return;

            this._subscribers.push({f:options?.weak === true ? new WeakRef(f) : f, once:options?.once ?? false, warnIfCollected:options?.warnIfCollected ?? true});
            
            return;
        }

        if (this._app.typeUtil.is<IDestructor<any>>(args[0], IDestructorType) === true)
        {
            const destructor = args[0];
            const f = args[1];
            const options = args[2] as {once?:boolean} | undefined;

            if (verify(f, destructor) !== true) return;

            const destructorFunc = async () => this.__unsubscribe(f);
            destructor.addDestructable(destructorFunc);

            this._subscribers.push({f:f, once:options?.once ?? false, warnIfCollected:true, destructor, destructorFunc, scope:new WeakRef(destructor)});
            
            return;
        }

        const scope = args[0];
        const f = args[1];
        const options = args[2] as {once?:boolean, weak?:boolean, warnIfCollected?:boolean} | undefined;

        if (verify(f, scope) !== true) return;

        //ensure that the provided function is a method of the provided scope (originally used compile time checking, but typescript kinda failed there, so i had to loosen things up a bit)
        if (this._app.debugUtil.isDebug === true && isMethodOf(scope, f) !== true) this._app.consoleUtil.error(this.constructor, 'function is not a method of the provided object.');

        this._subscribers.push({f:options?.weak === true ? new WeakRef(f) : f, once:options?.once ?? false, scope:options?.weak === true ? new WeakRef(scope) : scope, warnIfCollected:options?.warnIfCollected ?? true});
    }

    public __unsubscribe(scope:IObservable<any> | IDestructor<any>):void;
    public __unsubscribe(f:(...args:T) => R):void;
    public __unsubscribe(arg:IObservable<any> | IDestructor<any> | ((...args:T) => R)):void
    {
        let found = false;
        const subscribers = this._subscribers;
        if (this._app.typeUtil.isFunction(arg) === true)
        {
            const f = arg;

            for (let i = subscribers.length; i--;) 
            {
                const subscriber = subscribers[i];
    
                let eachFunc;
                if (subscriber.f instanceof WeakRef)
                {
                    eachFunc = subscriber.f.deref();
                    if (eachFunc === undefined)
                    {
                        if (subscriber.warnIfCollected === true) this._app.consoleUtil.warn(this.constructor, 'weak signal subscriber was already garbage collected. Please ensure that you are not using anonymous functions as weak signal subscribers and/or that you are properly unsubscribing from signals.');
                        subscribers.splice(i, 1);
                        continue;
                    }
                }
                else eachFunc = subscriber.f!;
    
                if (eachFunc !== f) continue;
    
                if (subscriber.destructor !== undefined && subscriber.destructorFunc !== undefined) subscriber.destructor.removeDestructable(subscriber.destructorFunc);

                subscribers.splice(i, 1);
                found = true;
            }

            if (found !== true) return; //it's okay if the function was not found, just return (keeping this unncessary check so we remember that it is okay)

            return;
        }

        for (let i = subscribers.length; i--;) 
        {
            const subscriber = subscribers[i];

            let scope:WeakKey | WeakRef<WeakKey> | undefined = subscriber.scope;

            if (scope === undefined) continue;

            if (scope instanceof WeakRef)
            {
                const deref = scope.deref();
                if (deref === undefined)
                {
                    if (subscriber.warnIfCollected === true) this._app.consoleUtil.warn(this.constructor, 'weak signal subscriber was already garbage collected. Please ensure that you are not using anonymous functions as weak signal subscribers and/or that you are properly unsubscribing from signals.');
                    subscribers.splice(i, 1);
                    continue;
                }

                scope = deref;
            }

            if (scope !== arg) continue;

            if (subscriber.destructor !== undefined && subscriber.destructorFunc !== undefined) subscriber.destructor.removeDestructable(subscriber.destructorFunc);

            subscribers.splice(i, 1);
            found = true;
        }

        if (found !== true) return; //it's okay if the scope was not found, just return (keeping this unncessary check so we remember that it is okay)
    }

    public __subscribed(scope:IObservable<any> | IDestructor<any>):boolean;
    public __subscribed(f:(...args:T) => R):boolean;
    public __subscribed(arg:IObservable<any> | IDestructor<any> | ((...args:T) => R))
    {
        const subscribers = this._subscribers;
        if (this._app.typeUtil.isFunction(arg) === true)
        {
            const f = arg;

            for (let i = subscribers.length; i--;) 
            {
                const subscriber = subscribers[i];
    
                let eachFunc;
                if (subscriber.f instanceof WeakRef)
                {
                    eachFunc = subscriber.f.deref();
                    if (eachFunc === undefined)
                    {
                        if (subscriber.warnIfCollected === true) this._app.consoleUtil.warn(this.constructor, 'weak signal subscriber was already garbage collected. Please ensure that you are not using anonymous functions as weak signal subscribers and/or that you are properly unsubscribing from signals.');
                        subscribers.splice(i, 1);
                        continue;
                    }
                }
                else eachFunc = subscriber.f!;
    
                if (eachFunc !== f) continue;
    
                return true;
            }

            return false;
        }

        for (let i = subscribers.length; i--;) 
        {
            const subscriber = subscribers[i];

            let scope:WeakKey | WeakRef<WeakKey> | undefined = subscriber.scope;

            if (scope === undefined) continue;

            if (scope instanceof WeakRef)
            {
                const deref = scope.deref();
                if (deref === undefined)
                {
                    if (subscriber.warnIfCollected === true) this._app.consoleUtil.warn(this.constructor, 'weak signal subscriber was already garbage collected. Please ensure that you are not using anonymous functions as weak signal subscribers and/or that you are properly unsubscribing from signals.');
                    subscribers.splice(i, 1);
                    continue;
                }

                scope = deref;
            }

            if (scope !== arg) continue;

            return true;
        }

        return false;
    }

    public clear():void { return void (this._subscribers.length = 0); }

    public dispatch(...args:T):R
    {
        let result = undefined;
        const subscribers = this._subscribers.slice();
        for (const subscriber of subscribers)
        {
            const index = this._subscribers.indexOf(subscriber);
            if (index === -1) 
            {
                //subscriber was removed during this dispatch cycle; skip execution.
                continue;
            }

            let eachFunc:((...args:T) => R);
            if (subscriber.f instanceof WeakRef) 
            {
                const deref = subscriber.f.deref();
                if (deref === undefined)
                {
                    if (subscriber.warnIfCollected === true) this._app.consoleUtil.warn(this.constructor, 'weak signal subscriber was already garbage collected. Please ensure that you are not using anonymous functions as weak signal subscribers and/or that you are properly unsubscribing from signals.');
                    this._subscribers.splice(index, 1);
                    continue;
                }

                eachFunc = deref;
            }
            else eachFunc = subscriber.f;

            if (subscriber.once) this._subscribers.splice(index, 1);
            
            let scope:WeakKey | WeakRef<WeakKey> | undefined = subscriber.scope;
            if (scope instanceof WeakRef)
            {
                const deref = scope.deref();
                if (deref === undefined)
                {
                    if (subscriber.warnIfCollected === true) this._app.consoleUtil.warn(this.constructor, 'weak signal subscriber was already garbage collected. Please ensure that you are not using anonymous functions as weak signal subscribers and/or that you are properly unsubscribing from signals.');
                    this._subscribers.splice(index, 1);
                    continue;
                }

                scope = deref;
            }

            if (this._dnited === true) return result as R;

            const innerResult = eachFunc.apply(scope, args);
            if (innerResult !== undefined) result = innerResult;
        }

        return result as R;
    }

    public get subscribers():number { return this._subscribers.length; }
}
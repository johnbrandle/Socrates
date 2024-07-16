/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IObservable } from "../IObservable.ts";
import { DestructableEntity } from "../entity/DestructableEntity.ts";
import { WeakKeyMap } from "../weak/WeakKeyMap.ts";
import type { IObservableManager } from "./IObservableManager.ts";
import { IObservableManagerType } from "./IObservableManager.ts";
import type { IDestructor } from "../IDestructor.ts";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator.ts";
import { IBaseApp } from "../IBaseApp.ts";

@ImplementsDecorator(IObservableManagerType)
export abstract class ObservableManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements IObservableManager<A>
{
    private _observables:WeakKeyMap<IObservable, number> = new WeakKeyMap<IObservable, number>(true);

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        this._destructablesSizeLimit = Number.MAX_SAFE_INTEGER; //we don't have a limit

        //yes, it is intentional that we are registering ourselves with ourselves, but we may reconsider this in the future
        this.register(this); //have to do this here instead of in Entity because of the way the constructor chain works
    }

    public register(observable:IObservable):void
    {
        if (this._observables.has(observable)) throw new Error('Observable already registered');

        observable.onChangeSignal.subscribe(this, this.onObservableChanged);
        this._observables.set(observable, performance.now());
    }

    public unregister(observable:IObservable):void
    {
        if (this._observables.has(observable) === false) throw new Error('Observable not registered');

        observable.onChangeSignal.unsubscribe(this.onObservableChanged);
        this._observables.delete(observable);
    }

    public isRegistered(observable:IObservable):boolean
    {
        return this._observables.has(observable);
    }

    protected abstract onObservableChanged(observable:IObservable, type:Symbol, changed:JsonObject | undefined):void;
}
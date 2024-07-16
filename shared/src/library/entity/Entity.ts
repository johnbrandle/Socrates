/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IBaseApp } from "../IBaseApp";
import { IObservableType, type IObservable } from "../IObservable";
import { IUIdentifiableType } from "../IUIdentifiable";
import type { IWeakSignal } from "../signal/IWeakSIgnal";
import { WeakSignal } from "../signal/WeakSignal";
import { uid } from "../utils/UIDUtil";
import { IObservableManager, IObservableManagerType } from "../managers/IObservableManager";
import { IEntity, IEntityType } from "./IEntity";

const array:string[] = new Array(64);

@ImplementsDecorator(IObservableType, IUIdentifiableType, IEntityType)
export abstract class Entity<A extends IBaseApp<A>> implements IEntity<A>
{
    #_onChangeSignal:WeakSignal<[IObservable<A>, type: Symbol, JsonObject | undefined]> | undefined;
    public get onChangeSignal():IWeakSignal<[IObservable<A>, type: Symbol, JsonObject | undefined]> { return this.#_onChangeSignal ?? (this.#_onChangeSignal = new WeakSignal(this._app)) };

    constructor(app:A, uid?:uid)
    {
        this._app = app;

        if (uid !== undefined) this.#_uid = uid;
        else
        {
            //if we use a util to generate the uid we will get a circular dependency
            for (let i = 64; i--;) array[i] = '0123456789abcdef'[(Math.random() * 16) | 0]; //we don't need this to be cryptographically secure, so we can use Math.random()

            this.#_uid = array.join('') as uid;
        }

       if (app.typeUtil.is<IObservableManager<A>>(this, IObservableManagerType) === false) app.observableManager.register(this); //have to exclude IObservableManager due how the constructor chain works. it will add itself in its constructor
    }

    protected _app:A;
    public get app():A { return this._app; }

    #_uid:uid;
    public get uid():uid { return this.#_uid; }

    public get className():string { return this.constructor.name; }

    protected log(...data:any[]):void { this._app.consoleUtil.log(this.constructor, ...data); }
    protected warn(...data:any[]):false { this._app.consoleUtil.warn(this.constructor, ...data); return false; }

    public toString():string { return this.className; }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

/**
 * A utility class for managing signals, allowing for easy adding and removal.
 */

import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import type { ISignal } from "../../../../../../shared/src/library/signal/ISignal";
import type { IWeakSignal } from "../../../../../../shared/src/library/signal/IWeakSIgnal";

export class SignalAssistant<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private readonly _context?:Object;

    private readonly _signalMap:Map<ISignal<any> | IWeakSignal<any>, ((...args:any) => any)[]> = new Map();

    constructor(app:A, destructor:IDestructor<A>, context?:Object) 
    {
        super(app, destructor);

        this._context = context;
    }

    public subscribe<T extends any[]>(signal:ISignal<T> | IWeakSignal<T>, handler:(...args:T) => any, once:boolean=false):void 
    {
        const boundHandler = this._context ? handler.bind(this._context) : handler;

        const handlers = this._signalMap.get(signal) ?? this._signalMap.set(signal, []).get(signal);

        if (handlers === undefined) throw new Error(`Failed to retrieve handlers for the given element.`);
        
        handlers.push(boundHandler);

        signal.subscribe(this, boundHandler, {once});
    }

    public unsubscribe(signal:ISignal<any> | IWeakSignal<any>):void 
    {
        const handlers = this._signalMap.get(signal);
        if (handlers === undefined) return;

        for (const handler of handlers) signal.unsubscribe(handler);
    }

    public clear():void
    {
        const signalMap = this._signalMap;
        for (const [signal, handlers] of signalMap) for (const handler of handlers) signal.unsubscribe(handler);
        
        this._signalMap.clear();
    }

    public async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        this.clear();

        return true;
    }
}
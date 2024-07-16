/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * Note: window.gc!(); //this causes issues with chrome. 
 * It breaks gc entirely after so many refreshes.
 * I must close and open the tab to get it to work again.
 */

import type { IObservable } from "../IObservable";
import type { IWeakSignal } from "../signal/IWeakSIgnal";
import { WeakSignal } from "../signal/WeakSignal";
import { WeakKeyMap } from "../weak/WeakKeyMap";
import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";
import { uid } from "./UIDUtil";

const MONITOR_INTERVAL = 250;

@SealedDecorator()
export class GCUtil<A extends IBaseApp<A>> 
{
    private _app:A;

    private _log:boolean;

    private readonly _markedForGC:WeakKeyMap<IObservable<A>, number> = new WeakKeyMap(true);
    private _finalizationRegistry:FinalizationRegistry<string>;

    private _gcPressurizer:WeakRef<Array<{}>> = new WeakRef<Array<{s:number}>>([]); //put pressure on the garbage collector

    public readonly onGCSignal:IWeakSignal<[number]>;

    private _watching:Set<uid> = new Set();
    public readonly onWatchedGCSignal:IWeakSignal<[uid]>;

    public constructor(app:A, log:boolean=false)
    {
        this._app = app;

        this._log = log;
        
        this._finalizationRegistry = new FinalizationRegistry((heldValue) => 
        {
            if (this._watching.has(heldValue as uid) === true)
            {
                this._watching.delete(heldValue as uid);

                this.onWatchedGCSignal.dispatch(heldValue as uid);
                return;
            }    

            if (log === true) app.consoleUtil.log(GCUtil, 'object collected in GCUtil', heldValue);
        });

        this.onGCSignal = new WeakSignal(app);
        this.onWatchedGCSignal = new WeakSignal(app);

        this.monitor();
    }

    /**
     * Marks an object for garbage collection.
     * @param object - The object to be marked for garbage collection.
     */
    public mark(object:IObservable<A>):void
    {
        if (this._app.debugUtil.isDebug !== true) return;

        if (this._markedForGC.has(object)) this._app.throw('object already marked for garbage collection', [], {correctable:true});

        this._markedForGC.set(object, performance.now());

        if (this._log === true) this._app.consoleUtil.log(GCUtil, 'object marked for garbage collection', object.className);

        this._finalizationRegistry.register(object, object.className, object);
    }
    
    /**
     * Monitors the garbage collector and applies pressure to try to force garbage collection to kick in.
     * If debug mode is enabled, it logs a debug message when pressure is applied.
     * It continuously checks if the garbage collector has collected the array and dispatches a signal when it does.
     * If the array is collected, it creates a new array and assigns it to the weak reference.
     * In debug mode, it applies pressure to the array by pushing objects into it.
     * It waits for a specified interval before checking again.
     */
    private async monitor():Promise<void>
    {
        const isDebug = this._app.debugUtil.isDebug;

        if (isDebug === true) this._app.consoleUtil.log(GCUtil, 'pressure:', true);

        while (true)
        {
            let array = this._gcPressurizer.deref();
            if (array === undefined) //gc has collected the array
            {
                this.onGCSignal.dispatch(performance.now());

                array = [];
                this._gcPressurizer = new WeakRef<Array<{}>>(array);
            }

            if (isDebug === true) //only apply pressure in debug mode; otherwise, use array to monitor gc events
            {
                for (let i = 2500; i--;) array.push({s:i});
            }
            array = undefined; //important to set this here, otherwise the array will be kept alive by the closure

            await this._app.promiseUtil.wait(MONITOR_INTERVAL);
        }
    }
    
    /**
     * @returns A map of objects that are pending garbage collection.
     */
    public getPending():WeakKeyMap<IObservable<A>, number>
    {
        const newMarkedForGC = new WeakKeyMap<IObservable<A>, number>(true);
        const markedForGC = this._markedForGC;
        for (const [key, value] of markedForGC) newMarkedForGC.set(key, value);
        
        return newMarkedForGC;
    }

    /**
     * Watches a target object for garbage collection. If the object is collected,
     * an event will be dispatched with the specified uid.
     * @param uid The uid to dispatch when the object is collected.
     * @param target The object to watch for garbage collection.
     */
    private _unwatchTokens:WeakSet<symbol> = new Set();
    public watch(uid:uid, target:IObservable<A>):symbol
    {
        if (this._watching.has(uid) === true) this._app.throw('object already being watched for garbage collection', [], {correctable:true});

        const unwatchToken = Symbol(uid);

        this._finalizationRegistry.register(target, uid, unwatchToken);

        this._watching.add(uid);

        this._unwatchTokens.add(unwatchToken);

        return unwatchToken;
    }

    /**
     * Stops watching an object for garbage collection.
     * @param uid The uid of the object to stop watching.
     */
    public unwatch(unwatchToken:symbol):void
    {
        const uid = unwatchToken.description as uid;

        if (this._unwatchTokens.has(unwatchToken) === false || this._watching.has(uid) === false) this._app.throw('object not being watched for garbage collection', [], {correctable:true});

        this._finalizationRegistry.unregister(unwatchToken);

        this._watching.delete(uid);
    }

    /**
     * Prevents an object from being garbage collected.
     * @param object The object to prevent from being garbage collected.
     */
    private _held:Set<IObservable<A>> = new Set();
    public hold(object:IObservable<A>):void
    {
        this._held.add(object);
    }

    /**
     * Allows an object to be garbage collected.
     * @param object The object to allow to be garbage collected.
     */
    public release(object:IObservable<A>):void
    {
        this._held.delete(object);
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IAbortableType, type IAbortable } from "../abort/IAbortable";
import { Entity } from "./Entity";
import type { IWeakSignal } from "../signal/IWeakSIgnal";
import { WeakSignal } from "../signal/WeakSignal";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IBaseApp } from "../IBaseApp";
import { uid } from "../utils/UIDUtil";
import { IAbortableEntity, IAbortableEntityType } from "./IAbortableEntity";
import { Turn, Turner } from "../basic/Turner";
import { AbortableHelper } from "../helpers/AbortableHelper";
import { IAborted } from "../abort/IAborted";

@ImplementsDecorator(IAbortableType, IAbortableEntityType)
export abstract class AbortableEntity<A extends IBaseApp<A>, R=any> extends Entity<A> implements IAbortableEntity<A, R>
{
    /**
     * Indicates whether the controller has been aborted.
     */
    protected _aborted = false;
    public get aborted():boolean { return this._aborted; }

    /**
     * The reason for aborting the controller.
     */
    #_reason = 'no reason provided';
    public get reason():string { return this.#_reason; }

    #_result:R | undefined;
    public get result():R 
    { 
        if (this._aborted === false) this._app.throw('The controller has not been aborted.', [], {correctable:true});

        return this.#_result!; 
    }

    #_abortController:AbortController | undefined;
    public get signal():AbortSignal 
    {
        if (this.#_abortController === undefined) 
        {
            this.#_abortController = new AbortController();
            if (this._aborted === true) this.#_abortController.abort(this.#_reason!);
        }
        
        return this.#_abortController.signal; 
    }

    /**
     * The signal that is triggered when the controller is aborted.
     */
    #_onAbortedSignal:IWeakSignal<[IAbortable<R>, string, R | undefined]> | undefined;
    public get onAbortedSignal():IWeakSignal<[IAbortable<R>, string, R | undefined]> { return this.#_onAbortedSignal ?? (this.#_onAbortedSignal = new WeakSignal(this._app)); }

    constructor(app:A, abortables:IAbortable | IAbortable[], uid?:uid);
    constructor(app:A, uid?:uid);
    constructor(app:A, ...args:any[])
    {
        if (args[0] !== undefined && app.typeUtil.isString(args[0]) !== true)
        {
            let [abortables, uid] = args as [IAbortable[], uid | undefined];

            super(app, uid);

            if (app.typeUtil.isArray(abortables) === false) this.addAbortable(abortables);
            else for (const abortable of abortables) this.addAbortable(abortable);
        } 
        else 
        {
            const [uid] = args as [uid | undefined];

            super(app, uid);
        }
    }

    public addAbortable(abortable:IAbortable):void
    {
        if (this._aborted === true) return;

        if (abortable.aborted !== true) 
        {
            if (abortable.onAbortedSignal.subscribed(this) === false) abortable.onAbortedSignal.subscribe(this, this.onAborted, {once:true, warnIfCollected:false}); //we have no dnit on abort controllers, so it's okay for it to be collected
            return; 
        }

        //so that the onAbortedSignal is triggered after the constructor has finished
        Promise.resolve().then(() => this._abort(abortable.reason ?? 'parent controller aborted', undefined));
    }

    /**
     * Callback function for handling aborted events.
     * @param controller - The abort controller.
     * @param reason - The reason for the abortion.
     */
    private onAborted = (_abortable:IAbortable, reason:string, _result:any) => { this._abort(reason, undefined); }
    
    /**
     * Aborts the operation and sets the result.
     * 
     * @param reason - The reason for aborting the operation.
     */
    protected _abort(reason:string, result?:R):IAborted<R>
    {
        if (this._aborted === true) return this as IAborted<R>;
        this._aborted = true; 
        
        this.#_reason = reason;
        this.#_result = result;
        this.#_abortController?.abort(reason);

        this.#_onAbortedSignal?.dispatch(this, this.#_reason, this.#_result);

        return this as IAborted<R>;
    }

    #_abortableHelper:AbortableHelper<A> | undefined;
    protected createAbortableHelper(abortable:IAbortable):AbortableHelper<A>
    {
        return abortable === this ? new AbortableHelper(this._app, abortable) : new AbortableHelper(this._app, this, abortable);
    }

    public get abortableHelper():AbortableHelper<A>
    {
        return this.#_abortableHelper ?? (this.#_abortableHelper = this.createAbortableHelper(this));
    }

    #_turner:Turner<A> | undefined;
    public get __turner():Turner<A> { return this.#_turner ?? (this.#_turner = new Turner(this._app)) };
    protected async getTurn(sharedTurn?:Turn<A>):Promise<Turn<A>>
    {
        const turner = this.__turner;
        
        if (sharedTurn !== undefined) 
        {
            if (turner !== sharedTurn.turner) this._app.throw('Turner mismatch', [], {correctable:true});

            return sharedTurn;
        }
        
        return await turner.getTurn({concurrency:false});
   }
}
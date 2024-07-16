/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortController } from "../../../../../../shared/src/library/abort/IAbortController";
import { Entity } from "../../../../../../shared/src/library/entity/Entity";
import type { IObservable } from "../../../../../../shared/src/library/IObservable";
import type { IResolveOnlyPromise } from "../../../../../../shared/src/library/promise/IResolveOnlyPromise";
import { ResolvePromise } from "../../../../../../shared/src/library/promise/ResolvePromise";
import type { IBaseApp } from "../IBaseApp";

/**
 * Manages a queue of asynchronous tasks, ensuring they are executed in a serial order.
 * Allows for tasks to be added to the queue and processed one after the other.
 * Supports aborting ongoing tasks through an abort controller.
 */
export class SerialHelper<A extends IBaseApp<A>> extends Entity<A>
{
    private _scope:IObservable<A>;
    private _abortController:IAbortController<A>;
    
    private _queue:{fn:(...args:any[]) => Promise<any> }[] = [];
    private _busy = false;

    /**
     * Creates an instance of SerialHelper.
     * 
     * @param {IObservable} scope - The observable scope in which tasks will be executed.
     * @param {IAbortable} abortable - The abort controller for managing task cancellation.
     */
    constructor(app:A, scope:IObservable<A>, abortController:IAbortController<A>)
    {
        super(app);

        this._scope = scope;
        this._abortController = abortController;
    }

    /**
     * Replaces the current abort controller with a new one and aborts any ongoing or queued task.
     * 
     * @param {IAbortable} abortable - The new abort controller to be used.
     * @returns {Promise<void>}
     */
    async renew(abortController:IAbortController<A>):Promise<void>
    {
        if (abortController === this._abortController) this._app.throw('abort controller cannot be the same', [], {correctable:true});

        this._abortController.abort('serial assistant renewed');
        this._abortController = abortController;
    }

    /**
     * Processes the next task in the queue, if any. 
     * Ensures that tasks are executed one at a time.
     * 
     * @private
     * @returns {Promise<void>}
     */
    async #next():Promise<void>
    {
        if (this._queue.length === 0) return;
        if (this._busy === true) return;
        this._busy = true;

        while (this._queue.length > 0)
        {
            const {fn} = this._queue.shift()!;

            await fn();
        }

        this._busy = false;
    }

    /**
     * Adds a task to the serial queue. The task can be either asynchronous or synchronous.
     * If the task is aborted or throws an error, it resolves with the provided default value.
     * 
     * @template A The argument type for the task function.
     * @template R The return type of the task function.
     * @param {(args: A) => Promise<R> | R} fn - The task function to be executed.
     * @param {any} defaultValue - The default value to return in case of abort or error.
     * @returns {(args: A) => IResolveOnlyPromise<R>} - A function that, when called, adds the task to the queue and returns a promise.
     */
    public add<A extends any[], R extends any>(fn:(...args:A) => Promise<R> | R, defaultValue:any):(...args:A) => IResolveOnlyPromise<R>
    {
        return (async (...args:A) => 
        {
            const abortController = this._abortController; //capture the abort controller reference, so that replacing the abort controller won't affect current or queued tasks

            const promise = new ResolvePromise<R>();

            const innerFn = async () => 
            {
                try
                {
                    if (abortController.aborted === true) return promise.resolve(defaultValue);

                    const result = await Promise.resolve(fn.apply(this._scope, args));

                    const aborted = abortController.check(result);
                    if (aborted === true) return promise.resolve(defaultValue);

                    return promise.resolve(result);
                }
                catch (error)
                {
                    this._app.consoleUtil.error(this.constructor, error);

                    return promise.resolve(defaultValue);
                }
            }

            this._queue.push({fn:innerFn});

            this.#next();

            return promise;
        }) as (...args:A) => IResolveOnlyPromise<R>;
    }
}

/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortController } from "../../../../../../shared/src/library/abort/IAbortController";
import { Entity } from "../../../../../../shared/src/library/entity/Entity";
import type { IBaseApp } from "../IBaseApp";

/**
 * The `ConcurrencyAssistant` class manages the execution of asynchronous operations, ensuring that
 * no more than a specified number of operations run concurrently. It also provides the ability to
 * prioritize the execution order of these operations (last-in-first-out or first-in-first-out)
 * and to abort the execution based on custom logic applied to the results of these operations.
 *
 * @template T - The type of the resolved value of each operation's promise.
 * @template R - The type of the result returned by the `abortable`, if any.
 */
export class ConcurrencyHelper<A extends IBaseApp<A>, T, R=unknown> extends Entity<A>
{
    private _concurrency:number;
    private _abortController:IAbortController<A, R>;
    private _lastInFirstOut:boolean;
    
    private _ongoing = 0;
    private _queue:{fn:() => Promise<T> }[] = [];
    private _onFinish:Array<(value?:void) => void> = [];
    private _onDrain:(() => void) | undefined;
    private _results:Array<Promise<T>> = [];

    /**
     * Constructs a `ConcurrencyAssistant`.
     *
     * @param {number} concurrency - The maximum number of operations to run concurrently.
     * @param {(result: T) => R | undefined} [abortable] - check called with the result of each operation.
     *         if it returns true, the assistant will abort further execution.
     * @param {boolean} [lastInFirstOut=false] - Determines whether to use LIFO (last-in-first-out)
     *        or FIFO (first-in-first-out) when taking operations from the queue.
     */
    constructor(app:A, concurrency:number, abortController:IAbortController<A, R>, lastInFirstOut=false)
    {
        super(app);

        this._concurrency = concurrency;
        this._abortController = abortController;
        this._lastInFirstOut = lastInFirstOut;
    }

    /**
     * Executes the next function in the queue, if there is one and the concurrency limit has not been reached.
     * If the queue is empty and there are no ongoing promises, calls the onDrain callback if it exists.
     * If the abort function exists and returns a non-undefined value, aborts the execution of the queue.
     * Decreases the ongoing count and processes the next promise once the current promise resolves or rejects.
     */
    #next():void
    {
        //if the queue is empty and there are no ongoing promises, call the onDrain callback if it exists.
        if (this._queue.length === 0)
        {
            if (this._onDrain && this._ongoing === 0) this._onDrain();
            
            return;
        }
       
        const lastInFirstOut = this._lastInFirstOut;
       
        //if we are not at max concurrency, take the next function from the queue and execute it.
        if (this._ongoing < this._concurrency)
        {
            this._ongoing++;

            const {fn} = lastInFirstOut === true ? this._queue.pop()! : this._queue.shift()!;
            
            const promise = fn().then(result =>
            {
                const aborted = this._abortController.check(result);
                if (aborted === true)
                {
                    this._onFinish.forEach(resolve => resolve());
                    if (this._onDrain) this._onDrain();
                }
            
                return result;
            })
            .finally(() =>
            {
                //once the promise resolves or rejects, decrease the ongoing count and process the next promise.
                this._ongoing--;
                if (this._onFinish.length > 0 && this._abortController.aborted !== true)
                {
                    const resolve = this._onFinish.shift()!;
                    resolve();
                }

                this.#next();
            });

            this._results.push(promise);
        }
    }

    /**
     * Adds an operation to the queue. If the maximum concurrency has been reached,
     * the operation will be queued until an ongoing operation completes.
     *
     * @param {() => Promise<T>} fn - A function that returns a promise, representing the operation to add.
     * @returns {Promise<boolean>} A promise that resolves to `true` if the execution was aborted,
     *                             or `false` otherwise.
     */
    public async add(fn:() => Promise<T>):Promise<boolean>
    {
        //if already aborted, return true.
        if (this._abortController.aborted === true) return true;
        
        //if we are at max concurrency, wait until there is space.
        if (this._ongoing >= this._concurrency) await new Promise<void>((resolve) => this._onFinish.push(resolve));
        
        //if the pool was aborted while we were waiting, return true.
        if (this._abortController.aborted as boolean === true) return true;
        
        //add the function to the queue and process the next promise.
        this._queue.push({fn});
        this.#next();
        
        return false;
    }

    /**
     * Adds an operation to the queue immediatly without waiting for concurrency availability.
     *
     * @param {() => Promise<T>} fn - A function that returns a promise, representing the operation to add.
     * @returns {boolean} `true` if the execution was aborted, or `false` otherwise.
     */
    public addImmediate(fn:() => Promise<T>):boolean 
    {
        if (this._abortController.aborted === true) return true;
    
        //add the function to the queue and process the next promise.
        this._queue.push({fn});
        this.#next();
    
        return false;
    }    

    /**
     * Drains the queue, waiting for all queued and ongoing operations to complete.
     *
     * @returns {Promise<T[]>} A promise that resolves to an array of the resolved values from all operations.
     */
    public async drain():Promise<T[]>
    {
        //if there are no promises left to process, return the results.
        if (this._queue.length === 0 && this._ongoing === 0) return Promise.all(this._results);
        
        //otherwise, wait until all promises are processed and then return the results.
        return new Promise(resolve =>
        {
            this._onDrain = () =>
            {
                resolve(Promise.all(this._results));
                this._onDrain = undefined;
            };
        });
    }

    /**
     * Returns a promise that resolves to the abort result if the assistant was aborted,
     * or waits for all operations to complete otherwise.
     *
     * @returns {Promise<R | undefined>} A promise that resolves to the abort result, or `undefined` if not aborted.
     */
    public async aborted():Promise<R | undefined>
    {
        //if already aborted, return the abort result.
        if (this._abortController.aborted === true) return this._abortController.result;
        
        //otherwise, wait until all promises are processed or we are aborted.
        await this.drain();

        return this._abortController.result;
    }
}

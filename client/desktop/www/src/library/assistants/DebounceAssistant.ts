/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { AbortController } from "../../../../../../shared/src/library/abort/AbortController";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import type { IBaseApp } from "../IBaseApp";
import type { IDestructable } from "../../../../../../shared/src/library/IDestructable";
import { ResolvePromise } from "../../../../../../shared/src/library/promise/ResolvePromise";
import type { IAborted } from "../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../shared/src/library/error/IError";
import type { IAbortable } from "../../../../../../shared/src/library/abort/IAbortable";

type Options = 
{
    /** optional id to assist with debugging */
    id?:string;

    /** If or how long we should wait before executing again. good for slowing updates down. */
    throttle?:boolean | number; 

    /** If or how long we should wait before executing. good for preventing unnecessary invalidation, e.g., duplicate calls. */ 
    delay?:boolean | number;

    /** If true, will log debug info to the console. */
    debug?:boolean;
}

/**
 * `DebounceAssistant` manages asynchronous operations by debouncing multiple simultaneous calls.
 * It executes an asynchronous operation and if further calls are made during execution, it marks the operation
 * as invalidated. Once the current operation completes, if it has been invalidated, it executes again to ensure
 * consistency with the latest state. This assistant is useful in scenarios where operations may be frequently 
 * triggered but should only reflect the latest state once completed, such as reacting to user input or state changes.
 *
 * It also supports throttling to control operation execution rate, aligning with UI rendering or other timing constraints.
 * The class provides lifecycle management to ensure proper cleanup of operations during application shutdown or 
 * component disposal.
 *
 * @implements {IObservable}
 * @implements {IDestructable}
 * 
 * @example
 * // Creating an instance and executing an action
 * const appInstance = new BaseApp(); // Assuming BaseApp implements IBaseApp
 * const asyncAction = async () => {
 *   // ... some asynchronous operation, e.g., Draw call
 * };
 * const assistant = new DebounceAssistant(appInstance, asyncAction, true);
 * assistant.execute(); // Will execute the provided asynchronous action with throttling
 * 
 * @example
 * // Triggering operation invalidation
 * assistant.execute(); // First call
 * // If `execute` is called again before the first call completes, it will not queue a new call
 * // Instead, it will mark the operation as invalidated and re-execute after completion if necessary
 * assistant.execute(); // Marks the operation for re-execution
 * // ... Later in the application lifecycle
 * assistant.dnit(); // Gracefully terminates and cleans up
 * 
 * Note 1: if you don't need the invalidation behaviour, consider using PromiseUtil.debounce or PromiseUtil.debounceWithCache instead.
 * Note 2: This class is particularly suited for drawing operations that may be triggered frequently but should only reflect the latest state.
 */
export class DebounceAssistant<A extends IBaseApp<A>, T extends any[] = [], R=any> extends DestructableEntity<A>
{
    private _options:Options = {throttle:false, delay:false};

    /** Holds the current active promise, if any */
    private _promise:ResolvePromise<R | IAborted | IError> | undefined;

    private _currentlyExecutingID:string | undefined;

    /** The asynchronous callback to execute when an action is triggered */
    private readonly _callback:((abortable:IAbortable<R>, ...args:T) => Promise<R | IAborted | IError>);

    /** Holds the current active delay promise, if any */
    private _delayPromise:Promise<void> | undefined;

    private _args:T = [] as unknown as T;

    /**
     * `DebounceAssistant` manages asynchronous operations by debouncing multiple simultaneous calls.
     * It executes an asynchronous operation and if further calls are made during execution, it marks the operation
     * as invalidated. Once the current operation completes, if it has been invalidated, it executes again to ensure
     * consistency with the latest state. This assistant is useful in scenarios where operations may be frequently 
     * triggered but should only reflect the latest state once completed, such as reacting to user input or state changes.
     *
     * It also supports throttling to control operation execution rate, aligning with UI rendering or other timing constraints.
     * The class provides lifecycle management to ensure proper cleanup of operations during application shutdown or 
     * component disposal.
     *
     * Additionally, it supports passing arguments to the callback function and an AbortController to manage the 
     * cancellation of the asynchronous operation.
     *
     * @implements {IObservable}
     * @implements {IDestructable}
     * 
     * @example
     * // Creating an instance and executing an action
     * const appInstance = new BaseApp(); // Assuming BaseApp implements IBaseApp
     * const asyncAction = async (abortable, ...args) => {
     *   // ... some asynchronous operation, e.g., Draw call
     * };
     * const assistant = new DebounceAssistant(appInstance, asyncAction, true);
     * assistant.execute(new AbortController(), arg1, arg2); // Executes with the provided AbortController and arguments
     * 
     * @example
     * // Triggering operation invalidation
     * assistant.execute(new AbortController(), arg1); // First call
     * // Subsequent calls before the first completes will mark the operation as invalidated and re-execute with the latest arguments
     * assistant.execute(new AbortController(), arg2); // Re-execution with new arguments
     * // ... Later in the application lifecycle
     * assistant.dnit(); // Gracefully terminates and cleans up
     * 
     * Note 1: if you don't need the invalidation behaviour, consider using PromiseUtil.debounce or PromiseUtil.debounceWithCache instead.
     * Note 2: This class is particularly suited for drawing operations that may be triggered frequently but should only reflect the latest state.
     */
    constructor(destructable:IDestructable<A>, callback:(abortable:IAbortable<R>, ...args:T) => Promise<R | IAborted | IError>, options?:Options)
    {
        super(destructable.app, destructable);

        this._callback = callback;
        this._options = options ?? this._options;
    }

    /**
     * Asynchronously executes a callback function with controlled delay and throttle mechanisms, while handling arguments and abort conditions. 
     * This method ensures that the execution is deferred based on the specified delay conditions 
     * and throttled to limit the frequency of execution.
     * 
     * The callback function is always called with the latest arguments (`args`). During rapid successive calls, 
     * the arguments are updated to ensure that the callback reflects the most recent state.
     * 
     * An `AbortController` is used to manage cancellation and early termination of the asynchronous operation. 
     * The callback should check the `abortable`'s state to determine if it should terminate early. 
     * Additionally, the callback may call `abortable.abort()` when applicable, to indicate that the current 
     * operation should be cancelled (e.g., when a new state renders the current operation irrelevant).
     * 
     * When a delay is active, the method waits for it to complete before proceeding. During this delay period, 
     * if a promise is already active, the method returns this promise without marking 
     * the execution as invalidated, thus avoiding re-execution due to rapid successive calls.
     * 
     * Outside of delay period, the method uses an invalidation mechanism for handling multiple rapid calls. 
     * The throttle mechanism is enhanced by measuring the actual execution time of the callback and adjusting 
     * the wait time accordingly. This ensures that the function runs with a consistent interval between executions, 
     * respecting either the time for the next animation frame or the specified number of milliseconds. 
     * It guarantees limited executions: once immediately, and once more if invalidated during the adjusted throttle interval.
     * 
     * This approach is particularly useful in scenarios where a function might be triggered excessively 
     * (e.g., due to user actions like resizing, scrolling) and needs to be executed in a controlled, optimized manner.
     * 
     * @async
     * @param {...any} args - Variable arguments to be passed to the callback function.
     * @returns {Promise<void>} A promise that resolves when the operation is completed, 
     *                          or exits early if a termination condition is met during a delay.
     */
    private _executeCount = 0;
    private _executeAbortController:AbortController<A> = new AbortController(this._app, this);
    public execute = async(...args:T):Promise<R | IAborted | IError> =>
    {
        let result:R | IAborted | IError | undefined;
        let promise:ResolvePromise<R | IAborted | IError> | undefined;

        this._args = args;

        const executionNum = this._executeCount++;
        const owner = this.destructor as IDestructable<A>;
        const options = this._options;
        const {throttle, delay, debug} = options;
        const id = options.id !== undefined ? `${executionNum}: ${owner.className}->${options.id}` : `${executionNum}: ${owner.className}`;

        const log = debug === true ? (message:string) => this.log(id, message) : undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            //if a delay is currently active, wait for it to complete before proceeding
            if (this._delayPromise !== undefined) 
            {
                log?.('delay in progress');

                _.check(await this._delayPromise);

                log?.('delay complete');

                //if a promise is active, return it, and skip marking this execution as invalidated (delay is supposed to avoid invalidation)
                //delay happens and is cleared before execution, so newly set args will be up to date for the execution
                if (this._promise !== undefined) 
                {
                    log?.(`already executing "${this._currentlyExecutingID}", returning existing promise`);
                    return this._promise;
                }
            }

            //if a promise is already active, mark that execution as invalidated and return the existing promise
            if (this._promise !== undefined) 
            {
                log?.(`already executing "${this._currentlyExecutingID}", invalidating, and returning existing promise`);

                this._executeAbortController.abort('execution invalidated'); //it's up to the callback to check the abort controller if necessary/desired
                
                return this._promise;
            }

            //initialize a new promise for this execution
            promise = this._promise = new ResolvePromise<R | IAborted | IError>();
            this._currentlyExecutingID = id;

            const throttleIsTypeOfNumber = this._app.typeUtil.isNumber(throttle);
            const delayIsTypeOfNumber = this._app.typeUtil.isNumber(delay);
            let now:number;
            
            //handle the delay mechanism
            if (delay === true) _.check(await (this._delayPromise = this._app.promiseUtil.nextAnimationFrame().then(() => this._delayPromise = undefined)));
            else if (delayIsTypeOfNumber === true) _.check(await (this._delayPromise = this._app.promiseUtil.wait(delay).then(() => this._delayPromise = undefined)));

            while (true) 
            {
                //let's see if we need to create a new abort controller for this execution
                const abortController = this._executeAbortController.aborted === true ? (this._executeAbortController = new AbortController(this._app, this)) : this._executeAbortController;

                if (throttleIsTypeOfNumber !== false) now = performance.now();

                log?.(`executing`);
                
                result = _.result(await this._callback(abortController, ...this._args));
                
                if (this._app.typeUtil.isError(result) === true) this._app.rethrow(result);

                log?.(`finished executing`);

                //handle the throttle mechanism
                if (throttle === true) _.check(await this._app.promiseUtil.nextAnimationFrame());
                else if (throttleIsTypeOfNumber === true) 
                {
                    log?.(`throttling`);

                    //reduce the throttle duration by the time it took to execute the callback
                    const elapsed = performance.now() - now!;
                    const remaining = Math.max(0, throttle - elapsed);

                    _.check(await this._app.promiseUtil.wait(remaining));

                    log?.(`finished throttling`);
                }

                //check if the execution has been invalidated while we were executing and/or waiting. if not, break the loop. otherwise, try again.
                if (abortController.aborted === false) break;
            }

            //return the promise representing this execution
            return promise;
        }
        catch (e)
        {
            const error = this._app.warn(e, 'Execution interrupted.', args, {names:[this.constructor, this.execute]});
            
            if (this._app.typeUtil.isAborted(error) === true) log?.(`execution aborted with reason: ${error.reason}`);
            else log?.(`execution failed with error: ${error.message}`);

            return result = error;
        }
        finally 
        {
            //clean up and resolve the promise
            if (promise !== undefined)
            {
                log?.(`done`);

                this._promise = undefined;
                this._currentlyExecutingID = undefined;
                this._delayPromise = undefined;
                this._args = [] as unknown as T;
                promise.resolve(result!);
            }
        }
    }

    public async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        await this._promise;
        
        return true;
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from '../decorators/SealedDecorator.ts';
import { IBaseApp } from '../IBaseApp.ts';

export const CLEAR_CACHE_FLAG = Symbol('PromiseUtil.CLEAR_CACHE');

interface DebouncedFunction<F extends (...args:any[]) => Promise<any>> 
{
    (...args:any[]):Promise<any>;
    (arg:typeof CLEAR_CACHE_FLAG):Promise<void>;
}

@SealedDecorator()
export class PromiseUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Returns a Promise that resolves after a specified delay.
     *
     * @param {number} delay - The number of milliseconds to wait before resolving the promise.
     * @returns {Promise<void>} - Promise that resolves after the specified delay.
     */
    public wait(delay:number):Promise<void> { return new Promise(resolve => setTimeout(resolve, delay)) };

    /**
     * Executes a collection of promise-returning functions (`promises`), limiting the number of concurrent executions
     * to `maxConcurrency`. This function is useful for controlling the load on the system when performing
     * multiple asynchronous operations, such as API requests, file operations, or any task that returns a promise.
     *
     * @template T - The type of the resolved value of each promise.
     * @param {Array<() => Promise<T>>} promises - An array of functions that return a promise when called.
     * @param {number} maxConcurrency - The maximum number of promises to execute concurrently.
     * @returns {Promise<T[]>} - A promise that resolves to an array of the resolved values from the input promises.
     *                           If any individual promise is rejected, the limit function rejects with that error.
     * @throws {Error} - Throws an error if `maxConcurrency` is less than or equal to 0.
     *
     * @example
     * // Example usage of limit
     * const asyncTask = (value) => new Promise(resolve => setTimeout(() => resolve(value), 1000));
     * const tasks = [1, 2, 3].map(num => () => asyncTask(num));
     * 
     * // Run the tasks with a concurrency limit of 2
     * PromiseUtil.limit(tasks, 2).then(results => {
     *   console.log(results); // Logs: [1, 2, 3] after all tasks have been completed
     * }).catch(error => {
     *   console.error('A task failed:', error);
     * });
     */
    public async limit<T>(promises:Array<() => Promise<T>>, maxConcurrency:number):Promise<T[]> 
    {
        if (maxConcurrency <= 0) this._app.throw('maxConcurrency must be greater than 0', [], {correctable:true});

        const results:Array<T> = [];
        let running = 0;
        let index = 0;
        
        return new Promise((resolve, reject) => 
        {
            const enqueue = async () => 
            {
                if (index === promises.length) 
                {
                    if (running === 0) resolve(results);
                    return;
                }

                running++;
                const promise = promises[index]();
                
                index++;
                
                try
                {
                    results.push(await promise);
                }
                catch(e)
                {
                    reject(e);
                    return;
                }
                
                running--;
                
                enqueue();
            };

            for (let i = 0; i < Math.min(maxConcurrency, promises.length); i++) enqueue(); //start the first batch of promises
        });
    }

    /**
     * Converts a function into a promise-based one with an optional condition for resolution.
     * The `promisify` method takes a function and returns a tuple containing a promise and a new function.
     * When the new function is called, it invokes the original function and resolves the promise with the result
     * if the `shouldResolve` condition is met. If `shouldResolve` is not provided, the promise resolves immediately
     * with the result of the function call.
     * 
     * @template F - A function type whose return type is used for the resulting promise.
     * @param {F} func - The function to be promisified.
     * @param {(result: ReturnType<F>) => boolean} [shouldResolve] - An optional predicate function that determines
     *        whether the promise should resolve based on the function result.
     * @returns {[Promise<ReturnType<F>>, F]} A tuple containing the promise and the new function.
     * 
     * @example
     * // Example usage for promisify
     * function syncFunction(x: number): number {
     *   return x * 2;
     * }
     * const [promise, callback] = PromiseUtil.promisify(syncFunction, result => result > 10);
     * callback(5);
     * // The promise will not resolve since 5 * 2 is not greater than 10
     * callback(6);
     * // Now the promise will resolve since 6 * 2 is greater than 10
     * promise.then(console.log); // Logs 12
     */
    public promisify<F extends (...args:any) => any>(func:F, shouldResolve?:(result:ReturnType<F>) => boolean):[Promise<ReturnType<F>>, F] 
    {
        let callback:F;
    
        const promise = new Promise<ReturnType<F>>((resolve:Function) => 
        {
            callback = ((...args:Array<any>) => 
            {
                const result = func.apply(null, args);
                
                if (shouldResolve !== undefined && shouldResolve(result) !== true) return; //only resolve the promise if result is true

                resolve(result);
            }) as F;
        });
    
        return [promise, callback!];
    }

    /**
     * Creates a promise that can be manually resolved with a provided callback function.
     * The `promise` method returns a tuple containing a promise and a callback function.
     * When the callback is called with a value, the promise resolves with that value.
     * This method is useful when you need a promise that resolves outside of the typical promise chain,
     * such as in event handlers or other asynchronous operations that do not return a promise.
     * 
     * @template T - The type that the promise will resolve with.
     * @returns {[Promise<T>, (arg:T) => void]} A tuple containing the promise and the function that resolves it.
     * 
     * @example
     * // Example usage for promise
     * const [promise, resolve] = PromiseUtil.promise<number>();
     * // ... later in the code or in some event handler
     * resolve(42);
     * // The promise is resolved with the value 42
     * promise.then(console.log); // Logs 42
     * 
     * @see ResolvePromise
     */
    public promise<T>():[Promise<T>, (arg:T) => void] 
    {
        let callback:(arg:T) => void;
    
        const promise = new Promise<T>((resolve:Function) => 
        {
            callback = (arg:T) => void resolve(arg);
        });
    
        return [promise, callback!];
    }

    /**
     * Creates a queued execution mechanism for an asynchronous function that shares successful results 
     * among all callers in the queue and isolates failure handling, allowing each call to independently 
     * retry after a failure.
     *
     * The function ensures that multiple invocations of the operation will wait for a single ongoing operation 
     * to complete. If the operation succeeds, the result is shared with all waiting invocations, efficiently 
     * leveraging a single operation's result. In case of a failure, as determined by the `failed` predicate, 
     * the next invocation in the queue will attempt the operation, allowing for independent handling of 
     * transient issues such as an abort signal or temporary network outage.
     *
     * @template F - A function type that returns a promise.
     * 
     * @param {F} f - The asynchronous function to be queued. This function should return a promise 
     *                that resolves with the operation's result or rejects if an error occurs.
     * @param {(result: ReturnType<F>) => boolean} failed - A predicate function that takes the result 
     *                                                      of `f` and returns `true` if the result 
     *                                                      is considered a failure and should trigger 
     *                                                      a retry by the next call in the queue.
     *
     * @returns {F} A function with the same signature as `f`. When invoked, it returns a promise that 
     *              resolves with the shared successful result or independently retries on failure 
     *              based on the `failed` predicate. Subsequent calls to this function while an 
     *              operation is in progress will be queued. Once an operation completes, if it is 
     *              successful, the result is shared with all queued calls. If it is a failure, the 
     *              next call in the queue will retry the operation.
     *
     * @example
     * // Function that might fail transiently
     * async function fetchData(): Promise<Data> {
     *   // fetch logic here
     * }
     *
     * // Predicate to determine if the result is a failure
     * function isFailure(result: Data | undefined): boolean {
     *   return result === undefined || result.needsRetry === true;
     * }
     *
     * // Creating a queued fetch function
     * const queuedFetchData = PromiseUtil.debounce(fetchData, isFailure);
     *
     * // Usage
     * queuedFetchData().then(result => {
     *   // handle result
     * }).catch(error => {
     *   // handle error
     * });
     */
    public debounce<F extends (...args:any) => Promise<any>>(f:F, failed:(result:ReturnType<F>) => boolean):F
    {
        let promise:Promise<any> | undefined;

        const debouncedFunction = (async (...args:any):Promise<any> =>
        {
            //if there's an ongoing promise, we chain the next call to it.
            //this reassignment ensures that if the current operation fails,
            //the subsequent one will take its place in the queue,
            //and if it succeeds, the result will be used for all waiting calls.
            if (promise !== undefined) return promise = promise.then(result => 
            {
                //evaluate the result using the `failed` predicate.
                const didFail = failed(result);

                //if the operation failed, the next call in the queue will attempt the operation.
                if (didFail === true) return debouncedFunction(...args);
                
                //if the operation succeeded, share the result with all subsequent calls.
                return result;
            });

            //if no promise is in progress, we start a new operation.
            try
            {
                promise = f(...args);

                return await promise;
            }
            catch(error)
            {    
                this._app.consoleUtil.warn(PromiseUtil, error);
            }
            finally
            {
                promise = undefined;
            }
        }) as F;

        return debouncedFunction;
    }

    /**
     * Wraps an asynchronous function to "debounce" and cache its calls. When multiple calls to the
     * wrapped function are made in quick succession, they will share the result of a single in-flight
     * promise. This approach optimizes performance by avoiding unnecessary duplicated operations.
     * 
     * The cache is persistent across calls until explicitly cleared or until the 'failed' callback
     * determines that the result of the promise is considered a failure, at which point the
     * cache is automatically cleared. To clear the cache manually, invoke the function with the
     * 'CLEAR_CACHE' argument provided by 'PromiseUtil'.
     * 
     * @important Don't return a stream, as it will be consume and not be available for subsequent calls.
     *
     * @template T The expected type of the resolved value of the promise.
     * @template F A function type that returns a Promise of type T, or undefined for a cache clearing signal.
     * @param {F} f The asynchronous function to be wrapped. This function should return a Promise of type T.
     * @param {(result: T | undefined) => boolean} failed A predicate function that takes the result of `f` and returns `true` if the result should be considered a failure.
     * @returns {DebouncedFunction<F>} A function with the same signature as `f`. This debounced version will return a cached result for simultaneous calls, provide a mechanism for cache clearing, and allow automatic cache invalidation upon a failure as determined by the `failed` predicate.
     *
     * @example
     * // Example usage
     * const someAsyncFunction = async () => { ... };
     * const debouncedFunction = PromiseUtil.debounceWithCache(someAsyncFunction, result => result === undefined);
     * 
     * // Logs the result, debouncing simultaneous calls
     * await debouncedFunction().then(console.log);
     * 
     * // Manually clear the cached promise
     * debouncedFunction(PromiseUtil.CLEAR_CACHE);
     */
    public debounceWithCache<T, F extends (...args:any[]) => Promise<T | undefined>>(f:F, failed:(result:ReturnType<F>) => boolean):DebouncedFunction<F> 
    {
        let promise:Promise<any> | undefined;
    
        const debouncedFunction:DebouncedFunction<F> = async (...args:any[]):Promise<any> => 
        {
            //special handling for CLEAR_CACHE
            if (args.length > 0 && args[0] === CLEAR_CACHE_FLAG) 
            {
                promise = undefined;
                return;
            }
    
            //if there's an ongoing promise, return it
            if (promise !== undefined) return promise = promise.then(result => 
            {
                const didFail = failed(result);

                if (didFail === true) return debouncedFunction(...args);
                
                return result;
            });
    
            //otherwise, invoke the function and return its promise
            try 
            {
                promise = f(...args);
                const result = await promise;

                const didFail = failed(result);

                //clear the cache if the result is a failure
                if (didFail === true) promise = undefined;
                
                return result;
            }
            catch (error)
            {
                //clear the cache if the promise is rejected
                promise = undefined;
                
                this._app.consoleUtil.warn(PromiseUtil, error);

                return undefined;
            }
        };
    
        return debouncedFunction;
    }
}
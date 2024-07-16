/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IResolveOnlyPromiseType, type IResolveOnlyPromise } from "./IResolveOnlyPromise";

/**
 * A `ResolvePromise` is an extension of the native JavaScript `Promise` that allows
 * resolution from outside its executor function. It behaves just like a regular `Promise`
 * but also provides a `resolve` method that can be used to resolve the associated promise
 * at a later time. This makes it suitable for cases where the resolution needs to be triggered
 * by some external event or condition.
 * 
 * @extends {Promise<T>}
 * @template T - The type of the value that the promise will be resolved with.
 * 
 * @see PromiseUtil.promise
 * 
 * @forceSuperTransformer_ignoreParent
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(IResolveOnlyPromiseType)
export class ResolvePromise<T> extends Promise<T> implements IResolveOnlyPromise<T>
{
    private _resolve!:(value:T | PromiseLike<T>) => void;
    private _resolved:boolean = false;

    constructor();
    constructor(callback=(...args:any) => {}) //this is a hack to make this all work, see: https://stackoverflow.com/questions/71441876/extending-a-promise-leads-to-promise-resolve-or-reject-function-is-not-callable
    {
        let localResolve:(value: T | PromiseLike<T>) => void;
        
        //call the parent constructor with the executor function
        super((resolve, reject) => 
        {
            //save the resolve function to an instance variable
            localResolve = resolve;

            return callback(resolve, reject);
        });

        //assign the localResolve to the class's private _resolve after super()
        this._resolve = localResolve!;
    }
  
    /**
     * Wraps a given promise or a function that returns a promise in a `ResolvePromise` instance, ensuring it never rejects.
     * If the original promise resolves, the `ResolvePromise` resolves with the same value.
     * If the original promise rejects, or if the function throws an error or returns a promise that rejects, 
     * the `ResolvePromise` resolves with the specified `rejectValue`.
     * 
     * @template T The type of the value with which the promise resolves.
     * 
     * @param {Promise<T> | (() => Promise<T>)} promiseOrFunction - The promise to be wrapped, or a function that returns a promise.
     * @param {T} rejectValue - The value with which the promise will resolve in case of a rejection or an error.
     * @returns {ResolvePromise<T>} A new `ResolvePromise` instance that wraps the given promise or the promise returned by the function.
     */
    public static wrap<T>(callback:() => Promise<T>, rejectValue:T):IResolveOnlyPromise<T>;
    public static wrap<T>(promise:Promise<T>, rejectValue:T):IResolveOnlyPromise<T>;
    public static wrap<T>(callback:() => Promise<T>):IResolveOnlyPromise<T | unknown>;
    public static wrap<T>(promise:Promise<T>):IResolveOnlyPromise<T | unknown>;
    public static wrap<T>(promise:Promise<T> | (() => Promise<T>), rejectValue?:T):IResolveOnlyPromise<T> | IResolveOnlyPromise<T | unknown>
    {
        const resolvePromise = new ResolvePromise<T>();

        const catchHandler = (error:any) => 
        {
            if (resolvePromise.resolved !== true) resolvePromise.resolve(arguments.length === 1 ? error : rejectValue);
        }
        
        if (promise instanceof Promise) promise.then((value:T) => resolvePromise.resolve(value)).catch(catchHandler);
        else
        {
            try
            {
                promise().then((value:T) => resolvePromise.resolve(value)).catch(catchHandler);
            }
            catch (error)
            {
                catchHandler(error);
            }
        }

        return resolvePromise;
    }

    /**
     * Overrides the `catch` method of the standard `Promise` to throw an error.
     * This is to ensure that `ResolvePromise` instances adhere to their design of never rejecting.
     * Attempting to use `catch` on a `ResolvePromise` instance will result in a runtime error.
     * 
     * @template TResult The type of the value that your function could return, or never if it throws.
     * 
     * @param {((reason: any) => TResult | PromiseLike<TResult>) | undefined} [onrejected] - The function to execute if the promise is rejected.
     * @throws {Error} Throws an error indicating that `ResolvePromise` does not support `catch`.
     */
    public override catch<TResult = never>(_onrejected?:((reason:any) => TResult | PromiseLike<TResult>) | undefined):never
    {
        throw new Error('ResolvePromise does not support catch()');
    }

    /**
     * Resolves the promise with a given value. If the value is a promise, the promise
     * becomes the result of that promise once it is resolved.
     * 
     * @param {T | PromiseLike<T>} value - The value to resolve the promise with.
     */
    public resolve(value:T | PromiseLike<T>):IResolveOnlyPromise<T>
    {
        if (this._resolved === true) throw new Error('ResolvePromise has already been resolved');
        this._resolved = true;

        this._resolve(value);

        return this;
    }

    public get resolved():boolean
    {
        return this._resolved;
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IObservable } from "../../../../../../shared/src/library/IObservable";

export const IWorkerManagerType = Symbol("IWorkerManager");

export interface IWorkerManager<A extends IBaseApp<A>>
{
    /**
     * Registers a new worker with the given key, path, and optional limit.
     * @param key - The unique key to register the worker under.
     * @param path - The path to the worker script.
     * @param limit - The maximum number of instances of the worker to create. Defaults to 1.
     * @throws {Error} If the key is already registered or if the limit is less than 1.
     */
    register(key:string, path:string, limit:number):void;
    
    /**
     * Checks if a worker with the given key is registered.
     * @param key - The key of the worker to check.
     * @returns True if the worker is registered, false otherwise.
     */
    isRegistered(key:string):boolean;

    /**
     * Borrows a worker from the pool for the specified borrower and key.
     * Throws an error if the key is not registered.
     * @param borrower - The borrower that is requesting a worker.
     * @param key - The key of the worker pool to borrow from.
     * @returns The borrowed worker.
     */
    borrow(borrower:IObservable, key:string):Worker;

    /**
     * Returns a borrowed worker to the pool.
     * @param borrower - The borrower that is returning the worker.
     * @param key - The key of the worker pool to return the worker to.
     * @param worker - The worker to return. Required if the worker pool has an unlimited limit.
     * @throws {Error} If the key is not registered, the worker is not borrowed, or the worker is required but not provided.
     * 
     * Optionally return the specific worker to have it terminated immediately.
     * If workers for a given key cannot be reused, set the limit to Number.MAX_SAFE_INTEGER or greater and always return with the worker.
     */
    return(borrower:IObservable, key:string, worker?:Worker):void;

    /**
     * Returns the total number of registered workers across all worker pools.
     * @returns The total number of registered workers.
     */
    getCount():number;

    /**
     * Returns an array of objects containing information about registered workers.
     * Each object contains a key representing the worker name and a count representing the number of active workers.
     * @returns An array of objects containing information about registered workers.
     */
    getWorkerInfo():{key:string, count:number}[];
}
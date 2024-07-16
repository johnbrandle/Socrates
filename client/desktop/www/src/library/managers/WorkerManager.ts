/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp.ts";
import type { IObservable } from "../../../../../../shared/src/library/IObservable.ts";
import { IntervalAssistant } from "../assistants/IntervalAssistant.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import { WeakKeyMap } from "../../../../../../shared/src/library/weak/WeakKeyMap.ts";
import type { IWorkerManager } from "./IWorkerManager.ts";
import { IWorkerManagerType } from "./IWorkerManager.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator.ts";

const hardwareConcurrency = window.environment.frozen.isMobile ? 1 : navigator.hardwareConcurrency || 4;
const TERMINATION_DELAY = 5000; //5 seconds

/**
 * Manages the lifecycle of web workers, including their registration, borrowing, and termination.
 * It ensures that workers are reused properly and destroyed when they are no longer needed.
 * Borrowing a worker does not guarantee exclusive access to that worker; it's meant to optimize
 * the reuse and proper termination of workers.
 */
@ImplementsDecorator(IWorkerManagerType)
export class WorkerManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements IWorkerManager<A>
{
    private _registeredWorkers:Map<string, {limit:number, path:string, index:number, borrowers:WeakKeyMap<IObservable<A>, {count:number}>, workers:Array<Worker | undefined>}> = new Map();

    private _workersEligibleForTermination:Map<string, number> = new Map();

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
 
        new IntervalAssistant(app, this, this).start(this.#terminateEligibleWorkers, TERMINATION_DELAY, false);
    }

    /**
     * Registers a new worker type with a specified key and path. The limit determines how many instances of
     * the worker can be created for concurrent operations, capped by the hardware concurrency level.
     * Registering a worker with the same key multiple times will result in an error.
     *
     * @param key - A unique identifier for the worker type.
     * @param path - The path to the worker's script file.
     * @param limit - The maximum number of concurrent workers allowed, defaults to 1.
     * @throws Error if the key is already registered or if the limit is not greater than zero.
     */
    public register(key:string, path:string, limit=1):void
    {
        if (this._registeredWorkers.has(key)) this._app.throw('key already registered', [key]);
        if (limit < 1) this._app.throw('limit must be greater than zero', [limit]);

        if (limit < Number.MAX_SAFE_INTEGER) limit = this._app.environment.frozen.isSafeMode === true ? 1 : Math.min(hardwareConcurrency, limit); //if the limit is less than max, then limit it to the hardware concurrency (unless in safe mode, then limit to 1)

        const workers = new Array<Worker>();
        const obj = {limit, path, index:0, workers, borrowers:new WeakKeyMap<IObservable<A>, {count:number}>()};

        this._registeredWorkers.set(key, obj);
    }

    /**
     * Sets the limit for the specified worker key.
     * @param key - The key to set the limit for.
     * @param limit - The new limit for the worker key.
     * @throws {Error} If the key is not registered or the limit is less than 1.
     */
    public setLimit(key:string, limit:number):void
    {
        const obj = this._registeredWorkers.get(key);
        if (!obj) this._app.throw('key not registered', [key]);
        if (limit < 1) this._app.throw('limit must be greater than zero', [limit]);

        if (obj.limit >= Number.MAX_SAFE_INTEGER) this._app.throw('cannot set limit for unlimited worker type', []);
        if (limit >= Number.MAX_SAFE_INTEGER) this._app.throw('cannot make limited worker type unlimited', []);

        if (this._app.environment.frozen.isSafeMode === true) limit = 1; //in safe mode, limit all worker types to 1

        obj.limit = limit;
    }

    /**
     * Allows an observable object to borrow a worker based on the specified key. It retrieves an available worker
     * or creates a new one if possible. The method ensures the reuse of workers but does not guarantee exclusive
     * access, as multiple observables can borrow the same worker instance.
     *
     * @param borrower - The observable object borrowing the worker.
     * @param key - The unique identifier for the type of worker to borrow.
     * @returns An instance of a Worker.
     * @throws Error if the key is not registered or other borrowing constraints are violated.
     */
    public borrow(borrower:IObservable<A>, key:string):Worker
    {
        const obj = this._registeredWorkers.get(key);
        if (!obj) this._app.throw('key not registered', [key]);

        const borrowers = obj.borrowers;
        if (borrowers.has(borrower) !== true) borrowers.set(borrower, {count:0});
        const borrowerObj = borrowers.get(borrower)!;
        borrowerObj.count++;

        this._workersEligibleForTermination.delete(key);

        const index = obj.index++ % obj.limit;
        const workers = obj.workers;

        if (workers[index] === undefined) workers[index] = new Worker(obj.path, {name:key + '_' + index});

        return obj.workers[index]!;
    }

    /**
     * Returns a worker that was previously borrowed. If the worker's limit is unlimited, it may be passed
     * to this method to ensure it is terminated. If the worker's limit is not unlimited, passing the worker
     * will result in an error, as shared workers are not supposed to be returned this way.
     *
     * @param borrower - The observable that is returning the worker.
     * @param key - The unique identifier for the type of worker being returned.
     * @param worker - The worker instance to return, required if the worker's limit is unlimited.
     * @throws Error if the key is not registered, if the borrower is not currently borrowing,
     * or if worker handling does not meet the required constraints.
     */
    public return(borrower:IObservable<A>, key:string, worker?:Worker):void
    {
        const obj = this._registeredWorkers.get(key);
        if (!obj) this._app.throw('key not registered', [key]);

        if (obj.limit >= Number.MAX_SAFE_INTEGER && worker !== undefined) //if the limit is unlimited, then the worker may be returned
        {
            //find worker, remove it, and terminate it
            const workers = obj.workers;
            const index = workers.indexOf(worker);
            if (index === -1) this._app.throw('worker not found', []);
            workers[index] = undefined;
            worker.terminate();
        }
        else if (worker !== undefined) this._app.throw('must return worker when limit is unlimited', []); //shared workers must not be returned (they will be reused, and may be in the middle of a task)

        const borrowers = obj.borrowers;
        if (!borrowers.has(borrower)) this._app.throw('borrower not borrowing', []);
        const borrowerObj = borrowers.get(borrower)!;

        borrowerObj.count--;
        if (borrowerObj.count !== 0) return;

        borrowers.delete(borrower);
        if (borrowers.size !== 0) return;
        
        this._workersEligibleForTermination.set(key, Date.now() + TERMINATION_DELAY);
    }

    /**
     * Terminates workers that are eligible for termination after a delay. It checks for workers that have
     * been inactive past their termination timeout and terminates them to free up resources.
     */
    #terminateEligibleWorkers = ():void =>
    {
        const workersEligibleForTermination = this._workersEligibleForTermination;
        if (workersEligibleForTermination.size === 0) return;

        const now = Date.now();
        const registeredWorkers = this._registeredWorkers;
        for (const [key, timeout] of workersEligibleForTermination)
        {
            if (timeout > now) continue;

            const obj = registeredWorkers.get(key)!;

            const workers = obj.workers;
            for (let i = workers.length; i--;)
            {
                const worker = workers[i];
                if (worker === undefined) continue;

                workers[i] = undefined;
                worker.terminate();
            }
            obj.workers.length = 0; //clear the array due to the MAX_SAFE_INTEGER limit (otherwise we could end up with a very large array of undefined)
            obj.index = 0; //reset the index

            this.log('terminated workers for key', key);

            workersEligibleForTermination.delete(key);
        }
    }

    /**
     * Gets the count of currently active workers.
     *
     * @returns The number of workers currently in use.
     */
    public getCount():number
    {
        let count = 0;
        const registeredWorkers = this._registeredWorkers;
        for (const [_key, value] of registeredWorkers)
        {
            const workers = value.workers;
            for (let i = workers.length; i--;) if (workers[i] !== undefined) count++;
        }

        return count;
    }

    /**
     * Retrieves information about all workers managed by this WorkerManager.
     *
     * @returns An array of objects containing the key of the worker type and the count of instances in use.
     */
    public getWorkerInfo():{key:string, count:number}[]
    {
        const workers = new Array<{key:string, count:number}>();
        const registeredWorkers = this._registeredWorkers;
        for (const [key, value] of registeredWorkers)
        {
            const count = value.workers.filter(worker => worker !== undefined).length;
            if (count === 0) continue;

            workers.push({key, count});
        }

        return workers;
    }

    /**
     * Checks if a worker key has been registered.
     * @param key - The key to check for registration.
     * @returns True if the key has been registered, false otherwise.
     */
    public isRegistered(key:string):boolean { return this._registeredWorkers.has(key); }
}
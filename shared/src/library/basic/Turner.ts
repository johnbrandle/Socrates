/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import { ResolvePromise } from "../promise/ResolvePromise";

/**
 * Manages the orderly execution of asynchronous operations through a system of turns.
 * Supports both sequential and concurrent execution strategies to ensure that operations
 * do not interfere with each other, allowing for controlled concurrency management within
 * the application. This class is essential for handling operations that require access to
 * shared resources or need to be executed in a specific order.
 * 
 * @class
 */
export class Turner<A extends IBaseApp<A>>
{
    private _app:A;

    private _queue:{promise:ResolvePromise<Turn<A>>, concurrency:boolean}[] = [];
    private _inProgress:{promise:ResolvePromise<Turn<A>>, concurrency:boolean}[] = [];

    private _lock:ResolvePromise<void> | undefined;
    private _waitingForTurnsToEndLock:ResolvePromise<void> | undefined;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Requests a new `Turn` for executing an operation. The turn can be executed immediately
     * if there are no other in-progress operations, or if concurrent execution is allowed and
     * another concurrent operation is in progress. Otherwise, the turn is queued until it can
     * be safely executed.
     * 
     * @param {Object} [options] - Configuration options for the turn.
     * @param {boolean} [options.concurrency=false] - Whether the requested turn supports concurrent execution.
     * @returns {Promise<Turn>} A promise that resolves with a `Turn` instance when it's ready to be executed.
     */
    public async getTurn(options?:{concurrency:boolean}):Promise<Turn<A>>
    {
        while (this._lock !== undefined || this._waitingForTurnsToEndLock !== undefined) await (this._lock ?? this._waitingForTurnsToEndLock);

        const promise = new ResolvePromise<Turn<A>>();
        
        if (this._inProgress.length === 0 || (options?.concurrency === true && this._inProgress[0].concurrency === true)) 
        {
            const obj = {promise, concurrency:options?.concurrency === true};

            //it's important that we add the object immediatly, otherwise it won't be immediatly included in the remaining count, which would could cause problems with lock
            //example issue: aquired a sucessful lock, got the remaining turns, wait for those turns to end, but oops, this turn was added while we were waiting even though we had a lock
            this._inProgress.push(obj);
            Promise.resolve().then(() => { promise.resolve(new Turn(this._app, this, () => this.#dequeue(obj))); });

            return promise;
        }

        this._queue.push({promise, concurrency:options?.concurrency === true});
       
        return promise;
    }

    /**
     * Private method to transition operations from the queue to the in-progress state.
     * This method is automatically called to manage the execution order of queued operations,
     * respecting the concurrency rules defined by each operation.
     * 
     * @param {Object} obj - The operation object to dequeue and execute.
     * @private
     */
    #dequeue(obj:{promise:ResolvePromise<Turn<A>>, concurrency:boolean})
    {
        const index = this._inProgress.indexOf(obj);
        if (index !== -1) this._inProgress.splice(index, 1);

        if (this._inProgress.length > 0 || this._queue.length === 0) return;            
        
        do
        {
            const obj = this._queue.shift()!;
            this._inProgress.push(obj);
            Promise.resolve().then(() => { obj.promise.resolve(new Turn(this._app, this, () => this.#dequeue(obj))); });
        }
        while (this._queue.length > 0 && this._queue[0].concurrency === true && this._inProgress[0].concurrency === true)
    }

    public async lock():Promise<void>
    {
        while (this._lock !== undefined) await this._lock;

        this._lock = new ResolvePromise<void>();
    }

    public unlock():void
    {
        if (this._lock === undefined) return;

        const lock = this._lock;

        this._lock = undefined;
        lock.resolve();
    }

    public async waitForTurnsToEnd():Promise<void>
    {
        if (this.remaining === 0) return;

        const waitingForTurnsToEndLock:ResolvePromise<void> = this._waitingForTurnsToEndLock = new ResolvePromise<void>();

        //get all turns
        const turns = [];
        for (const obj of this._queue) turns.push(obj.promise);
        for (const obj of this._inProgress) turns.push(obj.promise);

        //wait for all the turns to end
        await Promise.all(turns); 

        //wait a tick so we can ensure that no new turns are added before this promise resolves
        this._app.promiseUtil.wait(1).then(() => 
        {
            this._waitingForTurnsToEndLock = undefined;
            waitingForTurnsToEndLock.resolve();
        });
    }

    public get remaining()
    {
        return this._queue.length + this._inProgress.length;
    }
}

/**
 * Represents an individual asynchronous operation managed by a `Turner`. Provides mechanisms
 * to execute callbacks upon completion of the turn and to mark the operation as finished.
 * Turns ensure that complex asynchronous operations involving shared resources are executed
 * safely and in an orderly manner.
 * 
 * Note: it is critical that turns are ended, otherwise the associated turner will get stuck. Consider using 'finally' to ensure turns are ended.
 * 
 * @class
 * @param {Turner} [turner] - The `Turner` instance managing this turn. Optional.
 * @param {Function} [end] - A callback function to be executed when the turn ends. Optional.
 */
class Turn<A extends IBaseApp<A>>
{
    
    private _app:A;
    private _turner?:Turner<A>; //so a turner will not be garbage collected until all its turns are done, (so we can hold turner references weakly if we want to)
    
    private _ends:(() => void)[] = [];
    private _ended = false;
    private _onEndedPromise = new ResolvePromise<void>();

    constructor(app:A, turner?:Turner<A>, end?:() => void)
    {
        this._app = app;

        this._turner = turner;
        if (end !== undefined) this._ends.push(end);
    }

    /**
     * Adds completion callbacks from another turn or an array of turns to this turn.
     * This allows multiple asynchronous operations to be grouped and managed as a single
     * unit, ensuring that all associated operations are completed before the turn ends.
     * 
     * @param {Turn|Turn[]} turns - A single `Turn` instance or an array of `Turn` instances
     *                              whose completion callbacks are to be added to this turn.
     */
    public add(turns:Turn<A> | Turn<A>[])
    {
        if (this._ended === true) this._app.throw('Cannot add to an ended turn.', []);

        if (this._app.typeUtil.isArray(turns) === true) 
        {
            for (const turn of turns) this._ends.push(...turn._ends);

            return;
        }

        this._ends.push(...turns._ends);
    }

    /**
     * Marks the turn as ended and executes all registered completion callbacks. This method
     * should be called once the operation associated with this turn is complete. Calling this
     * method allows the `Turner` to proceed with executing subsequent operations in the queue.
     * 
     * Note: it is okay if this is called multiple times, it will only execute the end callbacks once.
     */
    public end()
    {
        if (this._ended === true) return;
        this._ended = true;

        for (const end of this._ends)
        {
            try
            {
                end();
            }
            catch (error)
            {
                this._app.warn(error, 'end callback failed', [], {names:[Turn, this.end]});
            }
        }

        this._onEndedPromise.resolve();
        
        this._turner = undefined;
        this._ends.length = 0;
    }

    public get ended():boolean
    {
        return this._ended;
    }

    public get onEnded():Promise<void>
    {
        return this._onEndedPromise;
    }

    public get turner():Turner<A> | undefined { return this._turner; }
}

export type { Turn };
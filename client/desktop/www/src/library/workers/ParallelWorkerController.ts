/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

//TODO, has not been tested

import type { IAbortable } from "../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../IBaseApp";
import type { IDatable } from "../../../../../../shared/src/library/data/IDatable";
import { ResolvePromise } from "../../../../../../shared/src/library/promise/ResolvePromise";
import { WorkerMessage } from "./WorkerMessage";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import { IntervalAssistant } from "../assistants/IntervalAssistant";
import { type uid } from "../utils/UIDUtil";

//abort only occurs one way. only the controller can abort the operation.
//if the controller aborts the operation, a message is sent to the worker, once a response is recieved, the controller will return the worker 

enum TaskExecutionState 
{
    Initialized = 0,
    Processing = 2,
    Done = 3,
    Aborting = 4,
    Aborted = 5,
    Timeout = 6,
    Error = 7
}

const INTERVAL_DURATION = 500;

type Options = {debug:boolean};

export abstract class ParallelWorkerController<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private _key:string;
    private _url:string;
    private _limit:number;
    private _abortable:IAbortable;
    private _options?:Options;

    private _worker?:Worker;
    private _tasks:{uid:uid, name:string, port1:MessagePort, startTime:number, timeout:number, state:TaskExecutionState, promise:ResolvePromise<void>}[] = [];

    private _intervalAssistant:IntervalAssistant<A>;

    /**
     * Creates an instance of the WorkerController.
     * 
     * @param {T} app - The base application instance.
     * @param {string} key - The key associated with the worker to manage uniqueness and concurrency.
     * @param {string} url - The URL of the worker script.
     * @param {number} limit - The concurrency limit for the workers.
     * @param {IAbortable} abortable - The controller used to signal abortion of tasks.
     */
    constructor(app:A, destructor:IDestructor<A>, key:string, url:string, limit:number, abortable:IAbortable, options?:Options)
    {
        super(app, destructor);

        this._key = key;
        this._url = url;
        this._limit = limit;
        this._abortable = abortable;
        this._options = options;

        this._intervalAssistant = new IntervalAssistant(app, this);

        this.#init();
    }

    /**
     * Initializes the worker controller by registering it with the worker manager.
     * This is done only if the worker with the specified key is not already registered.
     * 
     * Note: The worker manager is ultimately responsible for creating/reusing the worker instance.
     * The worker is responsable for managing the concurrency limit and task execution.
     * @private
     */
    #init():void
    {
        const key = this._key;
        const workerManager = this._app.workerManager;
        if (workerManager.isRegistered(key) !== true) workerManager.register(key, this._url, this._limit);
    }

    protected async _execute<T>(name:string, args:Record<string, any>, transferableObjects:Array<Transferable>, timeout:number, datable?:IDatable<Transferable>):Promise<T | undefined>
    {
        if (this._dnited === true) throw new Error('WorkerController is dnited');

        if (this._options?.debug === true) this.log('executing task:', this._key, name);

        if (this._abortable.aborted === true) return undefined; //aborted, no cleanup necessary as nothing was executed

        const worker = this._worker = this._worker ?? this._app.workerManager.borrow(this, this._key); //do not borrow on init, because lots of controllers may be made at the onset, but executed later
        const {port1, port2} = new MessageChannel();
        
        const uid = this._app.uidUtil.generate();

        const startTime = Date.now();
        const task = {uid, name, port1, timeout, startTime, state:TaskExecutionState.Initialized as TaskExecutionState, promise:new ResolvePromise<void>()};
        this._tasks.push(task);

        if (this._tasks.length === 1) this._intervalAssistant.start(this.#onInterval, INTERVAL_DURATION, false); //every x milliseconds check if the operation has timed out or been aborted (each task has a predefined time limit)

        let result:T | undefined;
        try
        {
            transferableObjects.push(port2); //port2 is transferred to the worker

            const promise = new ResolvePromise<T | undefined>();
            port1.onmessage = async (event:MessageEvent) =>
            {
                try
                {
                    const {uid, signal, result} = event.data;

                    switch (signal)
                    {
                        case WorkerMessage.Ready: //worker is ready to process the task
                            task.state = TaskExecutionState.Processing;

                            if (datable === undefined) 
                            {
                                port1.postMessage({signal:WorkerMessage.Data});
                                break;
                            }
                            
                            const transferable = await datable.get();
                            if (transferable === undefined) //undefined data indicates a desire to abort the operation
                            {
                                this.abort();
                                break;
                            }
    
                            port1.postMessage({signal:WorkerMessage.Data, transferable}, [transferable]);
                            break; 
                        case WorkerMessage.Done: //worker is done processing
                            task.state = TaskExecutionState.Done;

                            promise.resolve(result);
                            break;
                        case WorkerMessage.Aborted: //worker has finished aborting the operation
                            task.state = TaskExecutionState.Aborted;

                            promise.resolve(undefined);
                            break;
                        default:
                            throw new Error('Unhandled signal: ' + signal);
                    }
                }
                catch(error)
                {
                    console.warn(error);

                    task.state = TaskExecutionState.Error;
                    
                    promise.resolve(undefined);
                }
            }
            worker.postMessage({uid, name, port:port2, args}, transferableObjects);

            result = await promise;
        }
        catch(error)
        {
            console.warn(error);

            task.state = TaskExecutionState.Error;          
        }
        finally
        {
            this.#cleanup(task);
        }

        return result;
    }

    /**
     * Cleans up the task after it has completed or has been aborted. This involves clearing any intervals,
     * unregistering from the worker manager, and closing the message port. It also handles the destruction
     * of the controller if the `once` flag is set. it will return the worker to the worker manager for destruction
     * if the `limit` is set to `Number.MAX_SAFE_INTEGER` or greater.
     * @private
     */
    #cleanup = async (task:any) =>
    {
        const {port1, promise} = task;

        port1.onmessage = null;
        port1.close();

        promise.resolve(); //indicates we are done with the task
    
        this._tasks.splice(this._tasks.indexOf(task), 1);

        if (this._tasks.length === 0)
        {
            this._intervalAssistant.stop();

            //returning the worker indicates to the manager that the worker should be destroyed rather than reused.
            //Note: this is only true if the limit is greater than or equal to Number.MAX_SAFE_INTEGER (indicating no reuse). Otherwise, the worker manager will throw an error if the worker is returned.
            //Why? because reusable workers may have already been checked out by other controllers (a worker can be checked out more than once at a time, see WorkerManager), so destroying them would cause problems.
            this._app.workerManager.return(this, this._key, this._worker);
            this._worker = undefined;
        }
    }

    /**
     * Callback function that is executed on each interval of the worker.
     * It checks if the task has timed out, and aborts if so.
     * It also checks if the abort controller has been aborted, and aborts if so.
     */
    #onInterval = () =>
    {
        if (this._tasks.length === 0) throw new Error('Invalid state');

        for (const task of this._tasks)
        {
            const {name, startTime, timeout} = task;

            const time = Date.now();
            const maxTime = startTime + timeout;

            if (time >= maxTime) //check if the operation has timed out. if so, abort
            {
                if (task.state === TaskExecutionState.Aborting) 
                {
                    console.warn('worker task timed out while aborting:', name);

                    this.#cleanup(task); //force cleanup, and hope for the best
                    return;
                }

                if (task.state < TaskExecutionState.Done)
                {
                    console.warn('worker task timed out, attempting to abort:', name);
                
                    task.timeout += 1000 * 60 * 1; //give the worker 1 more minute to abort
                    return this.abort();
                }

                console.warn('worker task timed out with invalid state:', name, task.state);

                this.#cleanup(task);
            }

            if (this._abortable.aborted === true) this.abort(); //aborted
        }
    }

    /**
     * Aborts an ongoing task execution on the worker thread.
     * @returns {Promise<void>} A promise that resolves once the task has been successfully aborted.
     */
    public async abort():Promise<void> //three ways to abort: 1) return an undefined stream from the streamable, 2) call this method, 3) call this._abort() in the constructor
    {
        const promises = [];
        for (const task of this._tasks)
        {
            if (task.state === TaskExecutionState.Aborting) return task.promise; //already aborting, so just wait for the task to finish aborting
            if (task.state >= TaskExecutionState.Aborted) throw new Error('cannot abort task, invalid state: ' + task.state);
            
            task.port1.postMessage({signal:WorkerMessage.Cancel});

            promises.push(task.promise); //wait for the task to finish aborting
        }

        return void await Promise.all(promises);
    }

    /**
     * Destructor for the WorkerController, to clean up resources and ensure proper shutdown.
     * @returns {Promise<boolean>} A promise that resolves to true once the controller is properly destructed.
     */
    public async dnit(...args:any):Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        if (this._tasks.length !== 0) await this.abort();

        if (this._worker !== undefined) this._app.workerManager.return(this, this._key, this._worker); 
        this._worker = undefined;

        return true;
    }

    public get limit():number { return this._limit; }
}
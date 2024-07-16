/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

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
    Queued = 1,
    Processing = 2,
    Done = 3,
    Aborting = 4,
    Aborted = 5,
    Timeout = 6,
    Error = 7
}

const INTERVAL_DURATION = 500;

type Options = {debug:boolean};

/**
 * A controller for managing web workers and providing a simplified promise-based interface for communication.
 * It ensures that operations are queued and executed with respect to the concurrency limit.
 */
export abstract class WorkerController<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private _key:string;
    private _url:string;
    private _limit:number;
    private _abortable:IAbortable;
    private _useTheSameWorkerForEachTask:boolean;
    private _options?:Options;

    private _worker?:Worker;
    private _task?:{uid:uid, name:string, port1:MessagePort, startTime:number, timeout:number, state:TaskExecutionState, promise:ResolvePromise<void>};

    private _intervalAssistant:IntervalAssistant<A>;

    /**
     * Creates an instance of the WorkerController.
     * 
     * @param {T} app - The base application instance.
     * @param {string} key - The key associated with the worker to manage uniqueness and concurrency.
     * @param {string} url - The URL of the worker script.
     * @param {number} limit - The concurrency limit for the workers.
     * @param {IAbortable} abortable - The controller used to signal abortion of tasks.
     * @param {boolean} useTheSameWorkerForEachTask - A flag indicating if the same worker should be used for each task. (use when tasks have state)
     */
    constructor(app:A, destructor:IDestructor<A>, key:string, url:string, limit:number, abortable:IAbortable, useTheSameWorkerForEachTask:boolean=false, options?:Options)
    {
        //useTheSameWorkerForEachTask is only valid if the limit is Number.MAX_SAFE_INTEGER or greater. why? because 
        //we are expecting (at least for now) that setting this value to true indicates there is state sharing between
        //tasks, and therefore the worker cannot be reused. if the limit is less than Number.MAX_SAFE_INTEGER, then
        //the worker will be reused, and therefore the state will be reset, and therefore the state sharing will not work.
        if (useTheSameWorkerForEachTask === true && limit < Number.MAX_SAFE_INTEGER) app.throw('Cannot use the same worker for each task if the limit is less than Number.MAX_SAFE_INTEGER', [], {correctable:true});

        super(app, destructor);

        this.addAbortable(abortable);

        this._key = key;
        this._url = url;
        this._limit = limit;
        this._abortable = abortable;
        this._useTheSameWorkerForEachTask = useTheSameWorkerForEachTask;
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

    private _queue:Array<{name:string, args:Record<string, any>, transferableObjects:Array<Transferable>, timeout:number, datable?:IDatable<Transferable>, promise:ResolvePromise<any>}> = [];

    /**
     * Executes a task on the worker thread associated with the given key.
     * The worker manages an internal queue of tasks, processing them one at a time.
     * 
     * @template T The expected type of the execution result.
     * @param {string} name The name of the task to execute on the worker.
     * @param {Object} args An object containing arguments for the task execution.
     * @param {Transferable[]} transferableObjects An array of objects that are transferable to the worker thread.
     * @param {number} timeout The maximum amount of time (in milliseconds) to wait for the worker to complete.
     * @param {IDatable<T>} datable A streamable object that provides the data to be processed.
     * @returns {Promise<T | undefined>} A promise that resolves to the result of the worker operation or undefined if the operation fails or times out.
     * @throws {Error} Throws an error if the task fails to execute on the worker.
     * 
     * When a task is sent to the worker, it is added to the worker's internal queue.
     * Each queued task receives a `Queued` message. When the worker is ready to process the task,
     * it sends a `Ready` message, prompting the task to send its `Data`. If a task is aborted by the controller,
     * it will send an abort message, and wait to receive a reponse abort message from the worker.
     * 
     * The `_execute` method is designed to interface with this internal queueing system of the worker,
     * allowing tasks to be added to the queue regardless of the worker's current load, and managing
     * communication between the `WorkerController` and the worker instance for task execution and cancellation.
     * 
     * Usage example:
     * ```
     * const workerController = new ImageWorkerController(appInstance, false, abortableInstance);
     * workerController.generateThumbnail(streamableInstance, offscreenCanvas, 800, 600, 'image/jpeg')
     *   .then(result => {
     *     if (result) {
     *       // Handle the boolean result
     *     }
     *   })
     *   .catch(error => {
     *     // Handle any errors
     *   });
     * ```
     * 
     * The `transferableObjects` parameter should contain objects like `OffscreenCanvas` that can be transferred to the worker
     * without being cloned, for better performance.
     */
    protected async _execute<T>(name:string, args:Record<string, any>, transferableObjects:Array<Transferable>, timeout:number, datable?:IDatable<Transferable>):Promise<T | undefined>
    {
        if (this._dnited === true) this._app.throw('WorkerController is dnited', [], {correctable:true});
        if (this._task !== undefined)
        {
           if (this._useTheSameWorkerForEachTask === false) this._app.throw('WorkerController is already executing a task', [], {correctable:true}); //if the controller is executing a task, and the worker is meant to be reused, then throw an error

           if (this._options?.debug === true) this.log('queued task:', this._key, name);

            this._queue.push({name, args, transferableObjects, timeout, datable, promise:new ResolvePromise<T>()});
            return;
        }

        if (this._options?.debug === true) this.log('executing task:', this._key, name);

        if (this._abortable.aborted === true) return undefined; //aborted, no cleanup necessary as nothing was executed

        const worker = this._worker = this._worker ?? this._app.workerManager.borrow(this, this._key); //do not borrow on init, because lots of controllers may be made at the onset, but executed later
        const {port1, port2} = new MessageChannel();
        
        const uid = this._app.uidUtil.generate();

        const startTime = Date.now();
        const task = this._task = {uid, name, port1, timeout, startTime, state:TaskExecutionState.Initialized as TaskExecutionState, promise:new ResolvePromise<void>()};

        this._intervalAssistant.start(this.#onInterval, INTERVAL_DURATION, false); //every x milliseconds check if the operation has timed out or been aborted (each task has a predefined time limit)

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
                        case WorkerMessage.Queued: //worker has recieved the task message, and has queued the task.
                            task.state = TaskExecutionState.Queued;
                            break;
                        case WorkerMessage.Ready: //worker is ready to process the task
                            task.state = TaskExecutionState.Processing;

                            if (datable === undefined) 
                            {
                                port1.postMessage({signal:WorkerMessage.Data});
                                break;
                            }
                            
                            const transferable = this.abortableHelper.value(await datable.get());
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
                            throw this._app.throw('Unhandled signal: ' + signal, [], {correctable:true});
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
            this.#cleanup();
        }

        return result;
    }

    /**
     * Cleans up the task after it has completed or has been aborted. This involves clearing any intervals,
     * unregistering from the worker manager, and closing the message port.  it will return the worker to 
     * the worker manager for destruction if the `limit` is set to `Number.MAX_SAFE_INTEGER` or greater.
     * @private
     */
    #cleanup = async () =>
    {
        if (this._task === undefined) return;

        const {port1, promise} = this._task;
        this._task = undefined;

        this._intervalAssistant.stop();

        //if limit is Number.MAX_SAFE_INTEGER, then the worker is not meant to be reused. 
        //returning the worker indicates to the manager that the worker should be destroyed rather than reused.
        //Note: this is only true if the limit is greater than or equal to Number.MAX_SAFE_INTEGER (indicating no reuse). Otherwise, the worker manager will throw an error if the worker is returned.
        //Why? because reusable workers may have already been checked out by other controllers (a worker can be checked out more than once at a time, see WorkerManager), so destroying them would cause problems.
        if (this._useTheSameWorkerForEachTask !== true) 
        {
            this._app.workerManager.return(this, this._key, this._limit >= Number.MAX_SAFE_INTEGER ? this._worker : undefined);
            this._worker = undefined; 
        }
        
        port1.onmessage = null;
        port1.close();

        promise.resolve(); //indicates we are done with the task

        if (this._queue.length > 0) //process the next task in the queue
        {
            const {name, args, transferableObjects, timeout, datable, promise} = this._queue.shift()!;
            const result = await this._execute(name, args, transferableObjects, timeout, datable);
            promise.resolve(result);
        }
    }

    /**
     * Callback function that is executed on each interval of the worker.
     * It checks if the task has timed out, and aborts if so.
     * It also checks if the abort controller has been aborted, and aborts if so.
     */
    #onInterval = () =>
    {
        const executing = this._task;
        if (executing === undefined) this._app.throw('Invalid state', [], {correctable:true});

        const {name: task, startTime, timeout} = executing;

        const time = Date.now();
        const maxTime = startTime + timeout;

        if (time >= maxTime) //check if the operation has timed out. if so, abort
        {
            if (executing.state === TaskExecutionState.Aborting) 
            {
                console.warn('worker task timed out while aborting:', task);

                this.#cleanup(); //force cleanup, and hope for the best
                return;
            }

            if (executing.state < TaskExecutionState.Done)
            {
                console.warn('worker task timed out, attempting to abort:', task);
            
                executing.timeout += 1000 * 60 * 1; //give the worker 1 more minute to abort
                return this.abort();
            }

            console.warn('worker task timed out with invalid state:', task, executing.state);

            this.#cleanup();
        }

        if (this._abortable.aborted === true) this.abort(); //aborted
    }

    /**
     * Aborts an ongoing task execution on the worker thread.
     * @returns {Promise<void>} A promise that resolves once the task has been successfully aborted.
     */
    public async abort():Promise<void> //three ways to abort: 1) return an undefined stream from the streamable, 2) call this method, 3) call this._abort() in the constructor
    {
        const task = this._task;
        if (task === undefined) return; //we are not in the middle of a task, so just return
        
        if (task.state === TaskExecutionState.Aborting) return task.promise; //already aborting, so just wait for the task to finish aborting
        if (task.state >= TaskExecutionState.Aborted) this._app.throw('cannot abort task, invalid state: {}', [task.state], {correctable:true});
        
        task.port1.postMessage({signal:WorkerMessage.Cancel});

        return task.promise; //wait for the task to finish aborting
    }

    /**
     * Destructor for the WorkerController, to clean up resources and ensure proper shutdown.
     * @returns {Promise<boolean>} A promise that resolves to true once the controller is properly destructed.
     */
    public async dnit(...args:any):Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        if (this._queue.length > 0)
        {
            for (const {promise} of this._queue) promise.resolve(undefined);
            this._queue.length = 0;
        }
        if (this._task !== undefined) await this.abort();

        if (this._worker !== undefined) this._app.workerManager.return(this, this._key, this._limit >= Number.MAX_SAFE_INTEGER ? this._worker : undefined); 
        this._worker = undefined;

        return true;
    }

    public get limit():number { return this._limit; }
}
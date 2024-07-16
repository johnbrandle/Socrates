/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { uid } from "../utils/UIDUtil";
import type { IBaseApp } from "./IBaseApp";
import { WorkerMessage } from "./WorkerMessage";

export type Task =
{
    uid:uid;
    name:string;
    port:MessagePort;
    data?:Transferable;
    aborted:boolean;
    
    args:Record<string, any>;
    result?:any;
    transferableResults?:Array<Transferable>;
}

export abstract class Worker<A extends IBaseApp<A>>
{    
    protected _app:A;

    private _busy = false;

    private _queue:Array<Task> = [];
    private _currentTask:Task | undefined;

    constructor(app:A)
    {
        this._app = app;

        self.onmessage = this.onTaskRequest.bind(this);
    }

    /**
     * Processes the incoming message event to perform the task.
     * This function should be implemented by the subclass to define how messages are handled.
     * 
     * @param {MessageEvent} event - The message event from the main thread.
     * @returns {Promise<void>} A promise that resolves when the task processing is completed.
     */
    protected async onTaskRequest(event:MessageEvent):Promise<void>
    {
        const {uid, name, port, args} = event.data;

        this.queue({uid, name, port, aborted:false, args});
    }

    /**
     * Adds a task to the queue and triggers the task processing.
     * 
     * @param {Task} task - The task to be queued.
     */
    protected queue(task:Task)
    {
        this._queue.push(task);

        task.port.onmessage = (event:MessageEvent) => 
        {
            switch (event.data.signal)
            {
                case WorkerMessage.Data:
                    if (this._currentTask !== task) throw new Error('Invalid queue task'); //can only send data if it is the current task      

                    task.data = event.data.transferable;
                    this.execute(task);
                    break;
                case WorkerMessage.Cancel: //can cancel at any time
                    task.aborted = true;

                    this.#end(task, true);
                    break;
                default:
                    throw new Error('Unknown signal');
            }
        }

        task.port.postMessage({uid:task.uid, signal:WorkerMessage.Queued});

        this.dequeue();
    }

    /**
     * Processes the next task in the queue if the worker is not busy.
     * This method is called whenever a task is added to the queue or a task has been completed.
     */
    protected dequeue()
    {
        if (this._busy === true) return;

        const queue = this._queue;
        if (queue.length > 0)
        {
            this._busy = true;

            const task = queue.pop()!; //process last first

            this._currentTask = task;

            task.port.postMessage({uid:task.uid, signal:WorkerMessage.Ready});      
        }
    }

    /**
     * Retrieves the currently active queue item.
     * If no task is currently being processed, an error is thrown.
     * 
     * @returns {Task} The current queue item being processed.
     * @throws {Error} If no task is currently being processed.
     */
    protected get currentTask():Task
    {
        const currentQueueItem = this._currentTask;
        if (currentQueueItem === undefined) throw new Error('No current queue task');

        return currentQueueItem;
    }

    /**
     * Marks the completion of a task's processing and triggers the dequeue process.
     * This method should be called by the subclass once it has finished processing a task.
     * 
     * @param {Task} task - The task that has been completed.
     * @returns {Promise<void>} A promise that resolves when the task completion process has been handled.
     */
    protected async end(task:Task):Promise<void> 
    {
        return this.#end(task, false); 
    }

    /**
     * Marks the end of a task, either due to completion or early cancellation.
     * It will also handle the cleanup and continuation to the next task in the queue.
     * 
     * @param {Task} task - The task to mark as ended.
     * @param {boolean} earlyCancel - Whether the task was canceled early.
     */
    async #end(task:Task, earlyCancel:boolean):Promise<void>
    {
        if (task !== this._currentTask) //remove it from the queue
        {
            const queue = this._queue;
            const index = queue.indexOf(task);
            
            if (index === -1) throw new Error('Invalid queue task');
            
            queue.splice(index, 1);
         
            task.port.onmessage = null;
            task.port.postMessage({uid:task.uid, signal:WorkerMessage.Aborted, result:task.result}, task.transferableResults ?? []);
            task.port.close();
            return;
        }

        task.port.onmessage = null; //don't want to recieve any more messages from this port
        if (earlyCancel === true) return; //don't dequeue immediatly if the current task was canceled. it will call end again when it is finished (this way it can get to a good stopping point, rather than just abruptly ending it and starting a new one)

        this._currentTask = undefined;
        this._busy = false;

        task.port.postMessage({uid:task.uid, signal:task.aborted ? WorkerMessage.Aborted : WorkerMessage.Done, result:task.result}, task.transferableResults ?? []);
        task.port.close();

        this.dequeue();
    }

    /**
     * Initiates the execution of a task. This method should be implemented by the subclass to
     * define the actual task processing logic.
     * 
     * @param {Task} task - The task to execute.
     * @returns {Promise<any>} A promise that resolves with the result of the task execution.
     */
    protected abstract execute(task:Task):Promise<any>;
}
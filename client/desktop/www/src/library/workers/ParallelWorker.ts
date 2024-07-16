/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

//TODO, has not been tested

import type { Task } from "./Worker";
import { WorkerMessage } from "./WorkerMessage";

export abstract class ParallelWorker
{    
    private _tasks:Task[] = [];

    constructor()
    {
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

        this.add({uid, name, port, aborted:false, args});
    }

    /**
     * Adds a task and triggers the task processing.
     * 
     * @param {Task} task - The task to be queued.
     */
    protected add(task:Task)
    {
        this._tasks.push(task);

        task.port.onmessage = (event:MessageEvent) => 
        {
            switch (event.data.signal)
            {
                case WorkerMessage.Data:
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

        task.port.postMessage({uid:task.uid, signal:WorkerMessage.Ready});
    }

    protected get currentTasks():Task[]
    {
        return this._tasks;
    }

    protected async end(task:Task):Promise<void> 
    {
        return this.#end(task, false); 
    }

    async #end(task:Task, earlyCancel:boolean):Promise<void>
    {
        task.port.onmessage = null; //don't want to recieve any more messages from this port
        if (earlyCancel === true) return; //don't dequeue immediatly if the current task was canceled. it will call end again when it is finished (this way it can get to a good stopping point, rather than just abruptly ending it and starting a new one)

        this._tasks.splice(this._tasks.indexOf(task), 1);

        task.port.postMessage({uid:task.uid, signal:task.aborted ? WorkerMessage.Aborted : WorkerMessage.Done, result:task.result}, task.transferableResults ?? []);
        task.port.close();
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
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export enum WorkerMessage
{
    Data = 'data', //sent to worker in response to Ready
    Cancel = 'cancel', //sent to worker to cancel the current operation

    Queued = 'queued', //sent from worker to indicate that the worker has queued the command
    Ready = 'ready', //sent from worker to indicate that the worker is ready to process the command data

    //either Done or Canceled will be sent from the worker, but not both
    Done = 'done', //sent from worker to indicate that the worker is done processing
    Aborted = 'canceled' //sent from worker to indicate that the worker has cancelled the operation (only sent in response to a cancel message to the worker)
}
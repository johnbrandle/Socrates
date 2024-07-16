/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../IBaseApp";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { QueuedWorkerController } from "../QueuedWorkerController";
import { VideoTranscodeTask } from "./Shared";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../shared/src/library/error/IError";

const key = 'video-transcode';
const url = './js/worker_video.bundle.js';
const limit = 1;

export class VideoTranscodeWorkerController<A extends IBaseApp<A>> extends QueuedWorkerController<A>
{
    constructor(app:A, destructor:IDestructor<A>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable);
    }

    public async transcode(streamable:IDatable<ReadableStream<Uint8Array>>):Promise<Uint8Array | undefined | IAborted | IError>
    {
        return this.queue(async () => //ffmpeg has a memory leak, so we cannot reuse the worker, so used queue mechanism to ensure only one request is running at a time
        {
            try
            {
                const _ = this.abortableHelper.throwIfAborted();

                const task = VideoTranscodeTask.transcode;
                const args = {};
                const transferableObjects:Array<Transferable> = [];
                const timeout = Number.MAX_SAFE_INTEGER; //operation should not have a timeout
        
                const arrayBuffer = _.value(await this._execute<ArrayBuffer>(task, args, transferableObjects, timeout, streamable));
                if (arrayBuffer === undefined) return undefined;
        
                return new Uint8Array(arrayBuffer);
            }
            catch (error)
            {
                return this._app.warn(error, 'Error transcoding video', arguments, {names:[this.constructor, this.transcode]});
            }
        });
    }
}
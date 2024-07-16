/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../IBaseApp";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { QueuedWorkerController } from "../QueuedWorkerController";
import { VideoThumbnailTask } from "./Shared";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../shared/src/library/error/IError";

const key = 'video-thumbnail';
const url = './js/worker_video.bundle.js';
const limit = 2;

export class VideoThumbnailWorkerController<A extends IBaseApp<A>> extends QueuedWorkerController<A>
{
    constructor(app:A, destructor:IDestructor<A>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable);
    }

    public async generateThumbnail(streamable:IDatable<ReadableStream<Uint8Array>>):Promise<Uint8Array | undefined | IAborted | IError>
    {
        return this.queue(async () => //ffmpeg has a memory leak, so we cannot reuse the worker, so used queue mechanism to ensure only one request is running at a time
        {
            try
            {
                const _ = this.abortableHelper.throwIfAborted();

                const task = VideoThumbnailTask.generateThumbnail;
                const args = {};
                const transferableObjects:Transferable[] = [];
                const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

                const arrayBuffer = _.value(await this._execute<ArrayBuffer>(task, args, transferableObjects, timeout, streamable));

                if (arrayBuffer === undefined) return undefined;

                return new Uint8Array(arrayBuffer);
            }
            catch (error)
            {
                return this._app.warn(error, 'Error generating thumbnail', arguments, {names:[this.constructor, this.generateThumbnail]});
            }
        });
    }
}
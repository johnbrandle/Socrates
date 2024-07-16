/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../IBaseApp";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { QueuedWorkerController } from "../QueuedWorkerController";
import { VideoInfoTask, type Info } from "./Shared";

const key = 'video-info';
const url = './js/worker_video.bundle.js';
const limit = 4;

export class VideoInfoWorkerController extends QueuedWorkerController<IBaseApp>
{
    constructor(app:IBaseApp, destructor:IDestructor<IBaseApp>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable);
    }

    public async getInfo(streamable:IDatable<ReadableStream<Uint8Array>>):Promise<Info | undefined>
    {
        return this.queue(async () =>
        {
            const task = VideoInfoTask.getInfo;
            const args = {};
            const transferableObjects:Array<Transferable> = [];
            const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less
    
            return this._execute<Info>(task, args, transferableObjects, timeout, streamable);
        });
    }
}
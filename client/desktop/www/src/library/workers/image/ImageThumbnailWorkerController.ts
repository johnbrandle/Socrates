/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../IBaseApp";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { WorkerController } from "../WorkerController";
import { ImageThumbnailTask } from "./Shared";
import type { IError } from "../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";

const key = 'image-thumbnail';
const url = './js/worker_image.bundle.js';
const limit = 3;

export class ImageThumbnailWorkerController<A extends IBaseApp<A>> extends WorkerController<A>
{
    constructor(app:A, destructor:IDestructor<A>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable);
    }

    public async generateThumbnail(streamable:IDatable<ReadableStream<Uint8Array>>, maxWidth:number, maxHeight:number, mimeType:string):Promise<Uint8Array | undefined | IAborted | IError>
    {
        const task = ImageThumbnailTask.generate;
        const args = {maxWidth, maxHeight, mimeType};
        const transferableObjects:Transferable[] = [];
        const timeout = 60 * 1000 * 5; //operation should complete in 5 minutes or less

        const arrayBuffer = await this._execute<ArrayBuffer>(task, args, transferableObjects, timeout, streamable);
        if (arrayBuffer === undefined) return undefined;

        return new Uint8Array(arrayBuffer);
    }
}
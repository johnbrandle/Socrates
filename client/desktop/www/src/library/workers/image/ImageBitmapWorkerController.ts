/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../IBaseApp";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { WorkerController } from "../WorkerController";
import { ImageBitmapTask } from "./Shared";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../shared/src/library/error/IError";

const key = 'image-bitmap';
const url = './js/worker_image.bundle.js';
const limit = 6;

export class ImageBitmapWorkerController<A extends IBaseApp<A>> extends WorkerController<A>
{
    constructor(app:A, destructor:IDestructor<A>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable);
    }

    public async generateBitmap(streamable:IDatable<ReadableStream<Uint8Array>>, mimeType:string, maxWidth?:number, maxHeight?:number):Promise<ImageBitmap | undefined | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const task = ImageBitmapTask.generate;
            const args = {maxWidth, maxHeight, mimeType};
            const transferableObjects:Transferable[] = [];
            const timeout = 15 * 1000; //operation should complete in 15 seconds or less

            return _.value(this._execute<ImageBitmap>(task, args, transferableObjects, timeout, streamable));
        }
        catch (error)
        {
            return this._app.warn(error, 'Error generating bitmap', arguments, {names:[this.constructor, this.generateBitmap]});
        }
    }
}
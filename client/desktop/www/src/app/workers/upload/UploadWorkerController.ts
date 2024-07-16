/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { WorkerController } from "../../../library/workers/WorkerController";
import type { IApp } from "../../IApp";
import { UploadTask } from "./Shared";

const key = 'upload';
const url = './js/worker_upload.bundle.js';
const limit = 5;

export class UploadWorkerController<A extends IApp<A>> extends WorkerController<A>
{
    constructor(app:A, destructor:IDestructor<A>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable);
    }

    public async process(stream:IDatable<ReadableStream<Uint8Array>>, key:CryptoKey, partIndex:number, chunkSize:number):Promise<[Uint8Array, boolean] | undefined> //[the encrypted/compressed blob, flag indicating if blob is compressed]
    {    
        const task = UploadTask.process;
        const args = {key, partIndex, chunkSize};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 60; //operation should complete in 60 minutes or less

        const result = await this._execute<[ArrayBuffer, boolean]>(task, args, transferableObjects, timeout, stream);
        
        if (result === undefined) return undefined;

        const [arrayBuffer, isCompressed] = result;

        return [new Uint8Array(arrayBuffer), isCompressed];
    }
}
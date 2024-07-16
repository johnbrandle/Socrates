/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../IBaseApp";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import type { base64 } from "../../utils/BaseUtil";
import { WorkerController } from "../WorkerController";
import { BinaryBase64Task } from "./Shared";

const key = 'binary';
const url = './js/worker_binary.bundle.js';
const limit = 5;

export class BinaryWorkerController<A extends IBaseApp<A>> extends WorkerController<A>
{
    constructor(app:A, destructor:IDestructor<A>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable);
    }

    public toBase64(input:Uint8Array | string, isLatin1=false):Promise<base64 | undefined>
    {
        const task = BinaryBase64Task.to;
        const args = {input, isLatin1};
        const transferableObjects = this._app.typeUtil.isString(input) ? [] : [input.buffer];
        const timeout = 60 * 1000 * 5; //operation should complete in 5 minutes or less

        return this._execute<base64>(task, args, transferableObjects, timeout);
    }
}
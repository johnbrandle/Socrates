/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { AbortController } from "../../../../../../shared/src/library/abort/AbortController";
import type { IAbortable } from "../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import { ConcurrencyHelper } from "../helpers/ConcurrencyHelper";
import { ResolvePromise } from "../../../../../../shared/src/library/promise/ResolvePromise";
import { WorkerController } from "./WorkerController";
import type { IError } from "../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../shared/src/library/abort/IAborted";

/**
 * QueuedWorkerController
 * 
 * This is used when a worker cannot be reused. For example, ffmpeg has a memory leak, so we cannot reuse the worker.
 * Another reason may be if we don't want to have to worry about the worker being in a bad state.
 * 
 * The map is used to ensure only X of the same type of controller is running at a time.
 */
export class QueuedWorkerController<A extends IBaseApp<A>> extends WorkerController<A>
{
    private static _map:Map<Function, ConcurrencyHelper<any, any, any>> = new Map(); //associated with the constructors of QueuedWorkerController

    constructor(app:A, destructor:IDestructor<A>, key:string, url:string, limit:number, abortable:IAbortable)
    {
        super(app, destructor, key, url, Number.MAX_SAFE_INTEGER, abortable); //the limit is unlimited, so no limiting or reuse is occuring in WorkerController. instead, we use a PromisePool to do the limiting

        const map = QueuedWorkerController._map;
        if (map.has(this.constructor) === false) map.set(this.constructor, new ConcurrencyHelper<A, any, any>(app, limit, new AbortController(app), true));
    }

    protected async queue<T>(callback:() => Promise<T | IAborted | IError>):Promise<T | IAborted | IError>
    {
        const map = QueuedWorkerController._map;
        const concurrencyHelper = map.get(this.constructor)!;

        const promise = new ResolvePromise<T | IAborted | IError>();

        concurrencyHelper.addImmediate(async () => 
        {
            const result = await callback();

            promise.resolve(result);
        });

        return promise;
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IObservable } from "../../../../../../shared/src/library/IObservable";
import { Data } from "../../../../../../shared/src/library/data/Data";
import { ResolvePromise } from "../../../../../../shared/src/library/promise/ResolvePromise";
import { WeakKeyMap } from "../../../../../../shared/src/library/weak/WeakKeyMap";
import { MultipartArray } from "../../../../../../shared/src/library/multipart/MultipartArray";
import { ITranscodeManagerType, type ITranscodeManager } from "./ITranscodeManager";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import { AbortController } from "../../../../../../shared/src/library/abort/AbortController";
import type { IAbortController } from "../../../../../../shared/src/library/abort/IAbortController";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import type { IDriveFile } from "../../../../../../shared/src/library/file/drive/IDriveFile";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator";

export enum TranscodeType
{
    Audio = 'audio',
    Video = 'video',
    Image = 'image',
} 

type QueueItem<A extends IBaseApp<A>> =
{
    type:TranscodeType;
    time:number;
    file:IDriveFile<A>;
    abortController:IAbortController<A>;
    requesters:WeakKeyMap<IObservable<A>, ResolvePromise<boolean>>;
}

@ImplementsDecorator(ITranscodeManagerType)
export class TranscodeManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements ITranscodeManager<A>
{
    private _typeMaps:Map<TranscodeType, {limit:number, queue:Array<QueueItem<A>>, processing:Array<QueueItem<A>>}> = new Map();

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        for (const type of Object.values(TranscodeType)) this._typeMaps.set(type, {limit:2, queue:[], processing:[]});
    }

    public setLimit(type:TranscodeType, limit:number):void
    {
        const typeMap = this._typeMaps.get(type);
        if (typeMap === undefined) throw new Error(`FileTranscodeManager: key ${type} is not registered`);

        typeMap.limit = limit;
    }

    public async transcode(type:TranscodeType, requester:IObservable<A>, file:IDriveFile<A>):Promise<boolean>
    {
        const typeMap = this._typeMaps.get(type);
        if (typeMap === undefined) throw new Error(`FileTranscodeManager: key ${type} is not registered`);

        const {queue, processing} = typeMap;

        const multipartArray = new MultipartArray([queue, processing], {totalLength:queue.length + processing.length});

        for (const queueItem of multipartArray)
        {
            if (queueItem.file === file) 
            {
                if (queueItem.requesters.has(requester) === true) throw new Error(`FileTranscodeManager: requester ${requester} is already registered for file ${file}`);

                const promise = new ResolvePromise<boolean>();
                queueItem.requesters.set(requester, promise);

                return promise;
            }
        }

        const weakKeyMap = new WeakKeyMap<IObservable<A>, ResolvePromise<boolean>>();
        const promise = new ResolvePromise<boolean>();

        weakKeyMap.set(requester, promise);

        queue.push({type, time:Date.now(), file, abortController:new AbortController(this._app, this), requesters:weakKeyMap});
            
        this.#dequeue();

        return promise;
    }

    public abort(type:TranscodeType, requester:IObservable<A>, file:IDriveFile<A>):void
    {
        const typeMap = this._typeMaps.get(type);
        if (typeMap === undefined) throw new Error(`FileTranscodeManager: key ${type} is not registered`);

        const {queue, processing} = typeMap;

        for (let i = queue.length; i--;)
        {
            const queueItem = queue[i];

            if (queueItem.file !== file) continue; //filesystem should ensure that file references are shared, so this direct comparison should work
            
            const promise = queueItem.requesters.get(requester);
            if (promise === undefined)
            {
                this.warn(`requester ${requester} is not registered for file ${file}`); 
                if (queueItem.requesters.size !== 0) return; //requester is not registered for this file, and there are other requesters, so we can skip this item
            }
            else 
            {
                queueItem.requesters.delete(requester);
                promise.resolve(false);
            }
            
            if (queueItem.requesters.size !== 0) return;

            queue.splice(i, 1);
            
            return;
        }

        for (let i = processing.length; i--;)
        {
            const queueItem = processing[i];

            if (queueItem.file !== file) continue; //filesystem should ensure that file references are shared, so this direct comparison should work
            
            const promise = queueItem.requesters.get(requester);
            if (promise === undefined)
            {
                this.warn(`requester ${requester} is not registered for file ${file}`); 
                if (queueItem.requesters.size !== 0) return; //requester is not registered for this file, and there are other requesters, so we can skip this item
            }
            else 
            {
                queueItem.requesters.delete(requester);
                promise.resolve(false);
            }

            if (queueItem.requesters.size !== 0) return;
            
            processing.splice(i, 1);

            if (queueItem.abortController === undefined) throw new Error(`FileTranscodeManager: abort controller is undefined for file ${file}`);

            queueItem.abortController.abort('aborted by requester');

            this.#dequeue();
        }
    }

    #dequeue():void
    {
        for (const typeMap of this._typeMaps.values())
        {
            const {limit, queue, processing} = typeMap;

            if (processing.length >= limit) continue;
            if (queue.length === 0) continue;

            const queueItem = queue.shift()!;

            processing.push(queueItem);

            this.#process(queueItem);
        }
    }

    async #process(queueItem:QueueItem<A>):Promise<void>
    {
        const {type, file, abortController:abortable, requesters} = queueItem;

        let promise:Promise<Blob | undefined>;
        switch (type)
        {
            case TranscodeType.Audio:
            {
                promise = new ResolvePromise();
                break;
            }
            case TranscodeType.Video:
            {
                promise = this._app.videoUtil.transcode(new Data(this._app, () => file.getBytes(abortable)), await file.getMimeType() || '', abortable);
                break;
            }
            case TranscodeType.Image:
            {
                promise = new ResolvePromise();
                break;
            }
        }

        promise.then(async (blob) =>
        {
            if (abortable.aborted === true) 
            {
                this.#dequeue();
                return;
            }

            let success = blob !== undefined;
            if (success === true) success = await file.setTranscodedBytes(new Data(this._app, async () => blob!.stream()));

            for (const [requester, promise] of requesters)
            {
                promise.resolve(success);
                requesters.delete(requester);
            }

            const typeMap = this._typeMaps.get(type);
            if (typeMap === undefined) throw new Error(`FileTranscodeManager: key ${type} is not registered`);
    
            const {processing} = typeMap;
            const index = processing.indexOf(queueItem);
            if (index === -1) throw new Error(`FileTranscodeManager: queue item not found in processing queue`);
            processing.splice(index, 1);

            this.#dequeue();
        });
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../IBaseApp";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { WorkerController } from "../WorkerController";
import { PanDrawTask } from "./Shared";

const key = 'pan';
const url = './js/worker_pan.bundle.js';
const limit = Number.MAX_SAFE_INTEGER; //no limit

export class PanWorkerController<A extends IBaseApp<A>> extends WorkerController<A>
{
    constructor(app:A, destructor:IDestructor<A>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable, true);
    }

    public async init(largeCanvas:OffscreenCanvas, smallCanvas:OffscreenCanvas):Promise<boolean>
    {
        const task = PanDrawTask.init;
        const args = {largeCanvas, smallCanvas};
        const transferableObjects = [largeCanvas, smallCanvas];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return (await this._execute<boolean>(task, args, transferableObjects, timeout)) ?? false;
    }

    public async draw(widthLarge:number, heightLarge:number, widthSmall:number, heightSmall:number, tileMargin:number, zoom:number, visibleTileInfo:any, gridCanvasNavigationViewScaleFactor:number):Promise<boolean>
    {
        const task = PanDrawTask.draw;
        const args = {widthLarge, heightLarge, widthSmall, heightSmall, tileMargin, zoom, visibleTileInfo, gridCanvasNavigationViewScaleFactor};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return (await this._execute<boolean>(task, args, transferableObjects, timeout)) ?? false;
    }
}
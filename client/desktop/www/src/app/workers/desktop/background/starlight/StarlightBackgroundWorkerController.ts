/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../../../shared/src/library/abort/IAbortable";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IBaseApp } from "../../../../../library/IBaseApp";
import type { Performance } from "../../../../../library/managers/IPerformanceManager";
import { WorkerController } from "../../../../../library/workers/WorkerController";
import type { IFieldOptions, SpaceOptions } from "./Options";
import { StarlightBackgroundTask } from "./Shared";

const key = 'desktop_starlight_background';
const url = './js/worker_starlight.bundle.js';
const limit = Number.MAX_SAFE_INTEGER;

export class StarlightBackgroundWorkerController<A extends IBaseApp<A>> extends WorkerController<A>
{
    constructor(app:A, destructor:IDestructor<A>, abortable:IAbortable)
    {
        super(app, destructor, key, url, limit, abortable, true);
    }

    public async init(canvas:OffscreenCanvas, options:SpaceOptions, visibilityState:DocumentVisibilityState, hasFocus:boolean, performance:Performance):Promise<true | undefined>
    {    
        const task = StarlightBackgroundTask.init;
        const args = {canvas, options, visibilityState, hasFocus, performance};
        const transferableObjects:Array<Transferable> = [canvas];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async add(options:IFieldOptions):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.add;
        const args = {options};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async size(width:number, height:number):Promise<true | undefined>
    {
        const stask = StarlightBackgroundTask.size;
        const args = {width, height};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(stask, args, transferableObjects, timeout);
    }

    public async page(pageX:number, pageY:number):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.page;
        const args = {pageX, pageY};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async beta(beta:number, gamma:number):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.beta;
        const args = {beta, gamma};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async visibilityState(visibilityState:DocumentVisibilityState):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.visibilityState;
        const args = {visibilityState};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async hasFocus(hasFocus:boolean):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.focusState;
        const args = {hasFocus};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async fadeIn(frames:number):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.fadeIn;
        const args = {frames};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async fadeOut(frames:number):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.fadeOut;
        const args = {frames};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async performance(performance:Performance):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.performance;
        const args = {performance};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less

        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async shift(x:number, y:number):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.shift;
        const args = {x, y};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less
        
        return this._execute<true>(task, args, transferableObjects, timeout);
    }

    public async rotate(degrees:number):Promise<true | undefined>
    {
        const task = StarlightBackgroundTask.rotate;
        const args = {degrees};
        const transferableObjects:Array<Transferable> = [];
        const timeout = 60 * 1000 * 1; //operation should complete in 1 minute or less
        
        return this._execute<true>(task, args, transferableObjects, timeout);
    }
}
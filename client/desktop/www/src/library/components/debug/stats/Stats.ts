/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Component } from '../../Component.ts';
import { GlobalEvent } from '../../../managers/GlobalListenerManager.ts';
import type { IBaseApp } from '../../../IBaseApp.ts';
import { ComponentDecorator } from '../../../decorators/ComponentDecorator.ts';
import html from './Stats.html';
import { DebounceAssistant } from '../../../assistants/DebounceAssistant.ts';
import { DrawLineAssistant } from '../../../assistants/DrawLineAssistant.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';
import { IntervalAssistant } from '../../../assistants/IntervalAssistant.ts';
import { Performance } from '../../../managers/IPerformanceManager.ts';
import { SignalAssistant } from '../../../assistants/SignalAssistant.ts';
import { DevEnvironment } from '../../../../../../../../shared/src/library/IEnvironment.ts';
import type { IAbortable } from '../../../../../../../../shared/src/library/abort/IAbortable.ts';

class Elements
{
    canvas!:HTMLCanvasElement;
}

enum LineID
{
    FPS = 'fps',
    MouseCoords = 'MouseCoords',
    MemoryUsage = 'memoryUsage',
    JSHeap = 'jsHeap',
    GC = 'gc',
    Performance = 'performance',
    Workers = 'workers',
}

@ComponentDecorator()
export class Stats<A extends IBaseApp<A>> extends Component<A>
{
    private _coordX = 0;
    private _coordY = 0;

    private _lastGC = performance.now();

    private _drawLineAssitant!:DrawLineAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init(...args:any):Promise<void> 
    {
        const elements = this._elements;

        this.set(elements);

        let promise = super.init();

        if (this._app.environment.frozen.devEnvironment === DevEnvironment.Prod)
        {
            this._element.style.display = 'none';
            return promise;
        }
       
        const drawLineAssistant = this._drawLineAssitant = new DrawLineAssistant(this._app, this, elements.canvas);
        //loop through enum
        let index = 0;
        for (const value of Object.values(LineID)) drawLineAssistant.addLineAt(index++, value);

        //mouse move listener
        this.app.globalListenerManager.subscribe(this, GlobalEvent.Move, this.onMoveListened);
        
        this.#initMemoryUsage();
       
        //listen for GC
        new SignalAssistant(this._app, this).subscribe(this._app.gcUtil.onGCSignal, this.onGC);

        new IntervalAssistant(this._app, this).start(this._render.execute, true, false);

        return promise;
    }

    #toMB = (bytes:number) => Math.round(bytes / 1024 / 1024);

    private _memoryUsage = 'Calculating Memory Usage...';
    private _heapMemoryUsage = 'Calculating Heap Memory Usage...';
    #initMemoryUsage()
    {
        const interval = async () =>
        {
            const memoryInfo = await this._app.performanceManager.getMemoryInfo();

            if (memoryInfo.bytes !== undefined) this._memoryUsage = `Memory: ${this.#toMB(memoryInfo.bytes)} MB`;
            else this._memoryUsage = 'Memory Size Calculation Unsupported';

            if (memoryInfo.heap !== undefined) this._heapMemoryUsage = `JS Heap: ${Math.round(memoryInfo.heap.usedSize / 1024 / 1024)} MB / ${Math.round(memoryInfo.heap.totalSize / 1024 / 1024)} MB (${Math.round(memoryInfo.heap.sizeLimit / 1024 / 1024)} MB)`;
            else this._heapMemoryUsage = 'JS Heap Size Calculation Unsupported';
        }

        new IntervalAssistant(this._app, this).start(interval, true, false);
    }

    private onGC = (now:number) =>
    {
        this._lastGC = now;
    }

    public onMoveListened = (event:PointerEvent):void =>
    {
        this._coordX = event.clientX;
        this._coordY = event.clientY;

        this._render.execute();
    }

    private _render = new DebounceAssistant(this, async (_abortable:IAbortable) => 
    {
        if (this.initialized !== true) return; //if not initialized, return

        const app = this._app;

        let line:string;
        let lineCanvas = this._drawLineAssitant;

        line = 'FPS: ' + Math.round(app.performanceManager.fps);
        lineCanvas.write(LineID.FPS, line);

        line = `x: ${Math.round(this._coordX)}, y: ${Math.round(this._coordY)}`;
        lineCanvas.write(LineID.MouseCoords, line);

        lineCanvas.write(LineID.MemoryUsage, this._memoryUsage);

        lineCanvas.write(LineID.JSHeap, this._heapMemoryUsage);

        const elapsedSeconds = (performance.now() - this._lastGC) / 1000;
        line = `GC: ${elapsedSeconds.toFixed(0)} seconds ago`;
        lineCanvas.write(LineID.GC, line);

        line = 'Performance Mode: ' + Performance[app.performanceManager.recommended];
        lineCanvas.write(LineID.Performance, line);

        const workerInfo = this._app.workerManager.getWorkerInfo();
        let string = '(';
        for (const data of workerInfo)
        {
            if (string !== '(') string += ', ';

            string += `${data.key}: ${data.count}`;
        }
        string += ')';

        const count = workerInfo.length;
        line = 'Workers: ' + count + (count > 0 ? ' ' + string : '');
        lineCanvas.write(LineID.Workers, line);
    }, {throttle:125, delay:true, id:'_render'});

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
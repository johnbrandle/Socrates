/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp.ts";
import type { IWeakSignal } from "../../../../../../shared/src/library/signal/IWeakSIgnal.ts";
import { WeakSignal } from "../../../../../../shared/src/library/signal/WeakSignal.ts";
import { IPerformanceManagerType, type IPerformanceManager, Performance } from "./IPerformanceManager.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import { DebounceAssistant } from "../assistants/DebounceAssistant.ts";
import { IntervalAssistant } from "../assistants/IntervalAssistant.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator.ts";
import type { IAbortable } from "../../../../../../shared/src/library/abort/IAbortable.ts";
import type { IAborted } from "../../../../../../shared/src/library/abort/IAborted.ts";
import type { IError } from "../../../../../../shared/src/library/error/IError.ts";

@ImplementsDecorator(IPerformanceManagerType)
export class PerformanceManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements IPerformanceManager<A>
{
    private _onRecommendedSignal:IWeakSignal<[Performance]> = new WeakSignal(this._app, this);

    private _intervalAssistant!:IntervalAssistant<A>;

    private _recommended:Performance = Performance.High;

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        this._intervalAssistant = new IntervalAssistant(app, this, this);

        this.#init();
    }

    #init()
    {
        //default mobile and charging battery devices to low performance mode (unfortunatly, we cannot detect desktop vs laptop for charged devices)
        if (this._app.environment.frozen.isMobile) this.log('device is mobile, recommended performance changed to:', Performance[this._recommended = Performance.Low]);
        
        //@ts-ignore
        else if (navigator?.getBattery !== undefined)
        {
            //@ts-ignore
            navigator.getBattery().then((battery) =>
            {
                if (battery.chargingTime === 0) return;
                
                this.log('device is charging, recommended performance changed to:', Performance[this._recommended = Performance.Low]);
            });   
        }

        this.#monitorFPS();
    }

    private _fps = 0;
    #monitorFPS()
    {
        const updateEachSecond = 1000;
        const timeMeasurements:Array<number> = [];
    
        let fps = 0;
        const tick = () =>
        {
            const now = performance.now();
            timeMeasurements.push(now);

            let index = 0;
            while (index < timeMeasurements.length) 
            {
                if (now - timeMeasurements[index] > updateEachSecond) timeMeasurements.splice(index, 1); //remove the item at the current index
                else index++; //move to the next index
            }
    
            //calculate FPS if at least two measurements are available
            if (timeMeasurements.length >= 2) 
            {
                const millisecondsPassed = timeMeasurements[timeMeasurements.length - 1] - timeMeasurements[0];
                fps = (timeMeasurements.length - 1) / millisecondsPassed * 1000;
                    
                this._fps = fps;

                const currentRecommendedPerformance = this._recommended;
                let measuredPerformance;
                if (fps > 55) measuredPerformance = Performance.High;
                else if (fps > 30) measuredPerformance = Performance.Medium;
                else measuredPerformance = Performance.Low;

                if (measuredPerformance >= currentRecommendedPerformance) return;

                this.log('fps low, recommended performance changed to:', Performance[measuredPerformance]);

                this._recommended = measuredPerformance;
                this._onRecommendedSignal.dispatch(measuredPerformance);
            }
        };

        this._intervalAssistant.start(tick, true, false);
    }
    public get fps():number { return this._fps; }

    private _failedToMeasureMemory = false;
    private _memory = new DebounceAssistant(this, async (abortable:IAbortable):Promise<{heap?:{totalSize:number, usedSize:number, sizeLimit:number}, bytes?:number, breakdown?:Record<string, any>} | IAborted | IError> =>
    {
        try
        {
            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            const obj:{heap?:{totalSize:number, usedSize:number, sizeLimit:number}, bytes?:number, breakdown?:Record<string, any>} = {};

            //@ts-ignore
            if (performance.memory === undefined && performance.measureUserAgentSpecificMemory === undefined) return obj;

            //@ts-ignore
            if (performance.memory !== undefined)
            {
                //@ts-ignore
                const {totalJSHeapSize, usedJSHeapSize, jsHeapSizeLimit} = performance.memory;
                obj.heap = {totalSize:totalJSHeapSize, usedSize:usedJSHeapSize, sizeLimit:jsHeapSizeLimit};
            }

            //@ts-ignore
            if (performance.measureUserAgentSpecificMemory === undefined || this._failedToMeasureMemory === true) return obj;
            
            try
            {
                //@ts-ignore
                const memorySample = _.value(await performance.measureUserAgentSpecificMemory());
                obj.bytes = memorySample.bytes;
                obj.breakdown = memorySample.breakdown;
            }
            catch(error)
            {
                this._failedToMeasureMemory = true;
            }

            return obj;
        }
        catch (error)
        {
            return this._app.warn(error, 'Error occurred while measuring memory.', [], {names:[PerformanceManager, '_memory']});
        }
    }, {id:'_memory', delay:true, throttle:true});
    public async getMemoryInfo():Promise<{heap?:{totalSize:number, usedSize:number, sizeLimit:number}, bytes?:number, breakdown?:Record<string, any>}> { return (await this._memory.execute()) ?? {}; }

    public get recommended():Performance
    {
        return this._recommended;
    }

    public get onRecommendedSignal():IWeakSignal<[number]>
    {
        return this._onRecommendedSignal;
    }
}
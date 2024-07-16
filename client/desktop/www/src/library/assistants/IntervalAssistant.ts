/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";

export class IntervalAssistant<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private readonly _context?:Object;

    private _running?:{duration:number | true, frameID:number | undefined, canceled:boolean};
    public get isRunning():boolean { return this._running !== undefined; }

    constructor(app:A, destructor:IDestructor<A>, context?:Object) 
    {
        super(app, destructor);

        this._context = context;
    }

    public start(handler:(...args:any[]) => any, duration:number | true, once:boolean=false):IntervalAssistant<A>
    {
        if (this._running !== undefined) throw new Error(`An interval is already running.`);

        const boundHandler = this._context !== undefined ? handler.bind(this._context) : handler;

        this._running = {duration, frameID:undefined, canceled:false};
        const running = this._running;

        const tick = async () =>
        {
            running.frameID = undefined;

            if (this._dnited === true || running.canceled === true) return;

            const result = await boundHandler();

            if (this._dnited as boolean === true || running.canceled as boolean === true) return;

            if (once === true) 
            {
                this._running = undefined;
                return result;
            }

            running.frameID = running.duration === true ? requestAnimationFrame(tick) : self.setTimeout(tick, running.duration);
        }

        running.frameID = running.duration === true ? requestAnimationFrame(tick) : self.setTimeout(tick, running.duration);

        return this;
    }

    public stop():void 
    {
        const running = this._running;
        if (running === undefined) return;
        running.canceled = true;

        this._running = undefined;

        if (running.frameID === undefined) return;
        
        if (running.duration === true) cancelAnimationFrame(running.frameID);
        else self.clearTimeout(running.frameID);
            
        running.frameID = undefined;
    }

    public async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        this.stop();

        return true;
    }
}
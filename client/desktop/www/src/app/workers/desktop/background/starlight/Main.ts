/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Worker, type Task } from "../../../../../library/workers/Worker.ts";
import { StarlightBackgroundTask } from "./Shared.ts";

import { Field } from './field/Field.ts';
import { ConstellationField } from './field/ConstellationField.ts';
import { RandomField } from './field/RandomField.ts';
import { Space } from './Space.ts';
import { Star } from './particle/Star.ts';
import type { IConstellationFieldOptions, IFieldOptions, IRandomFieldOptions, SpaceOptions } from "./Options.ts";
import type { Performance } from "../../../../../library/managers/IPerformanceManager.ts";
import type { IBaseApp } from "../../../../../library/workers/IBaseApp.ts";
import { BaseApp } from "../../../../../library/workers/BaseApp.ts";

const DEFAULT_FRAME_RATE_INTERVAL = 1000 / 14;
const LOW_POWER_FRAME_RATE_INTERVAL = 1000 / 30;
const BOOSTED_FRAME_RATE_INTERVAL = 1000 / 45;

const app = new (class extends BaseApp<IBaseApp<any>> 
{
})();
type A = typeof app;

class Main extends Worker<A>
{    
    private _space!:Space;

    private _blurred = false;
    private _visibilityState = 'visible';
    
    private _hidden = false; 
    
    private _frameInterval = DEFAULT_FRAME_RATE_INTERVAL;

    protected async execute(task:Task):Promise<any>
    {    
        try
        {
            switch (task.name)
            {
                case StarlightBackgroundTask.init:
                {
                    const canvas = task.args.canvas as OffscreenCanvas;
                    const options = task.args.options as SpaceOptions;
                    const visibilityState = task.args.visibilityState as DocumentVisibilityState;
                    const hasFocus = task.args.hasFocus as boolean;
                    const performance = task.args.performance as Performance;
    
                    if (task.aborted === true) return;

                    this._visibilityState = visibilityState;
                    this._blurred = !hasFocus;
                    this._hidden = this._visibilityState === 'hidden' || this._blurred;

                    await this.#init(canvas, options);
                    this._space.performance = performance;
                    
                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.fadeIn:
                {
                    const frames = task.args.frames as number;
    
                    if (task.aborted === true) return;

                    this._frameInterval = BOOSTED_FRAME_RATE_INTERVAL; //speed up to fps temporarily
                    this._space.fadeIn(frames);
                    
                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.fadeOut:
                {
                    const frames = task.args.frames as number;
    
                    if (task.aborted === true) return;

                    this._frameInterval = BOOSTED_FRAME_RATE_INTERVAL; //speed up to fps temporarily
                    this._space.fadeOut(frames);
                    
                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.add:
                {
                    const options = task.args.options as IFieldOptions;
    
                    if (task.aborted === true) return;

                    switch (options.type)
                    {
                        case 'constellation':
                            this._space.add(new ConstellationField(this._space, options as IConstellationFieldOptions, (field:Field, positionWithin?:{min:{x:number, y:number}, max:{x:number, y:number}}) => new Star(field, positionWithin)));
                            return;
                        case 'random':
                            this._space.add(new RandomField(this._space, options as IRandomFieldOptions, (field:Field, positionWithin?:{min:{x:number, y:number}, max:{x:number, y:number}}) => new Star(field, positionWithin)));
                            return;
                    }
                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.performance:
                {
                    const performance = task.args.performance as Performance;
    
                    if (task.aborted === true) return;

                    this._space.performance = performance;
                    
                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.size:
                {
                    const width = task.args.width as number;
                    const height = task.args.height as number;
    
                    if (task.aborted === true) return;

                    this._frameInterval = BOOSTED_FRAME_RATE_INTERVAL; //speed up to fps temporarily
                    this._space.onResize(width, height);
                    
                    if (!this._hidden) this._space.draw();

                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.page:
                {
                    const pageX = task.args.pageX as number;
                    const pageY = task.args.pageY as number;
    
                    if (task.aborted === true) return;

                    this._frameInterval = BOOSTED_FRAME_RATE_INTERVAL; //speed up to fps temporarily
                    
                    const space = this._space;
                    space.pageX = pageX;
                    space.pageY = pageY;

                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.beta:   
                {
                    const beta = task.args.beta as number;
                    const gamma = task.args.gamma as number;
    
                    if (task.aborted === true) return;

                    this._frameInterval = BOOSTED_FRAME_RATE_INTERVAL; //speed up to fps temporarily
                    
                    const space = this._space;
                    space.beta = beta;
                    space.gamma = gamma;

                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.shift:
                {
                    const x = task.args.x as number;
                    const y = task.args.y as number;
    
                    if (task.aborted === true) return;

                    this._frameInterval = BOOSTED_FRAME_RATE_INTERVAL; //speed up to fps temporarily
                    this._space.shift(x, y);
                    
                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.rotate:
                {
                    const degrees = task.args.degrees as number;
    
                    if (task.aborted === true) return;

                    this._frameInterval = BOOSTED_FRAME_RATE_INTERVAL; //speed up to fps temporarily
                    this._space.rotate(degrees);
                    
                    if (task.aborted as boolean === true) return;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.visibilityState:
                {
                    if (task.aborted === true) return;

                    this._visibilityState = task.args.visibilityState as DocumentVisibilityState;
                    this._hidden = this._visibilityState === 'hidden' || this._blurred;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                case StarlightBackgroundTask.focusState:
                {
                    const hasFocus = task.args.hasFocus as boolean;
                    
                    if (task.aborted === true) return;

                    this._blurred = !hasFocus;
                    this._hidden = this._visibilityState === 'hidden' || this._blurred;

                    task.result = true;
                    task.transferableResults = [];
                    break;
                }
                default:
                    console.warn('Unknown task:', task.name);
            }
        }
        catch(error) 
        {
            console.warn(error);
        }
        finally
        {
            this.end(task);
        }
    }

    async #init(canvas:OffscreenCanvas, options:SpaceOptions):Promise<void> 
    {   
        const space = this._space = new Space(canvas, options);

        let lastFrameTime = 0;
        
        const update = () =>
        {
            const currentTime = performance.now();
            const elapsed = currentTime - lastFrameTime;
    
            if (space.performance < 2) 
            {
                if (this._frameInterval === BOOSTED_FRAME_RATE_INTERVAL) this._frameInterval = LOW_POWER_FRAME_RATE_INTERVAL;
                else if (this._frameInterval === DEFAULT_FRAME_RATE_INTERVAL && space.isFadeingIn === false && space.isFadeingOut === false)
                {
                    requestAnimationFrame(update);
                    return;
                }
            }

            if (elapsed <= this._frameInterval) 
            {
                if (!this._hidden) space.update();

                this._frameInterval = DEFAULT_FRAME_RATE_INTERVAL; //reset to default frame rate interval
                requestAnimationFrame(update);
                return;
            }
            
            lastFrameTime = currentTime - (elapsed % this._frameInterval);

            space.update();
    
            if (!this._hidden) space.draw();
            
            requestAnimationFrame(update);
        }

        update();
    }
}

new Main(app);
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import type { IAbortController } from "../../../../../../shared/src/library/abort/IAbortController";

/**
 * Options for configuring the TweenAssistant.
 */
type Options<A extends IBaseApp<A>> =
{
    target?:any;

    duration?:number;
    delay?:number;
    
    ease?:(t:number, b:number, c:number, d:number, params?:any) => number;
    
    onStart?:() => void;
    onUpdate?:(progress:number) => void;
    onComplete?:() => void;

    abortController?:IAbortController<A>;
}

/**
 * Represents an item in the queue.
 */
type QueueItem<A extends IBaseApp<A>> =
{
    options:Options<A>;
    init:() => Record<string, {start:number, end:number, type:'px' | 'number'}>;
}

export type Tween =
{
    abort:() => void, 
    kill:() => void
}
 
export class TweenAssistant<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private _defaultOptions?:Options<A>;
    private _autoAbort:boolean;

    private _activeTween?:Tween;
    private _queue:QueueItem<A>[] = [];

    constructor(app:A, destructor:IDestructor<A>, defaultOptions?:Options<A>, autoAbort:boolean=false)
    {
        super(app, destructor);

        this._defaultOptions = defaultOptions;
        this._autoAbort = autoAbort;
    }

    //todo, remove static method. put in util if needed
    public static to<A extends IBaseApp<A>>(app:A, endValues:Record<string, any>, options:Options<A>):Tween
    {
        if (options.target === undefined) app.throw('target is undefined', []);

        const init = () =>
        {
            const startValues:Record<string, any> = {};
            for (const key in endValues) startValues[key] = options!.target[key];

            return TweenAssistant.#getStartAndEndValues(app, startValues, endValues, options!);
        };

        return TweenAssistant.#animate(app, {init, options}, () => {});
    }

    /**
     * Animates the target object properties to the specified end values.
     * 
     * @param endValues - The end values for the target object properties.
     * @param options - The options for the animation.
     */
    to(endValues:Record<string, any>, options?:Options<A>):void
    {
        options = {...this._defaultOptions, ...options};

        if (options.target === undefined) this._app.throw('target is undefined', []);

        const init = () =>
        {
            const startValues:Record<string, any> = {};
            for (const key in endValues) startValues[key] = options!.target[key];

            return TweenAssistant.#getStartAndEndValues(this._app, startValues, endValues, options!);
        };

        this._queue.push({init, options});

        this.#dequeue();
    }

    static #getStartAndEndValues = <A extends IBaseApp<A>>(app:A, start:Record<string, any>, end:Record<string, any>, options:Options<A>) =>
    {
        const values:Record<string, {start:number, end:number, type:'px' | 'number'}> = {};

        const processValue = (key:string, value:any):{value:number, type:'px' | 'number'} =>
        {
            if (typeof value === 'string') 
            {
                if (value.endsWith('px') === true) return {value:parseFloat(value), type:'px'};

                return {value:parseFloat(value), type:'number'};
            }
            
            return {value:parseFloat(value), type:'number'};
        }

        for (const key in start) 
        {
            const startValue = processValue(key, start[key]);
            const endValue = processValue(key, end[key]);

            if (isNaN(startValue.value)) app.throw('unsupported value type', [startValue.value]);
            if (isNaN(endValue.value)) app.throw('unsupported value type', [endValue.value]);

            if (startValue.type !== endValue.type) app.throw('type mismatch', [startValue.type, endValue.type]);

            values[key] = {start:startValue.value, end:endValue.value, type:startValue.type};
        }
        
        return values;
    }

    /**
     * Sets the starting values for the tween animation.
     * @param startValues - The starting values for the animation.
     * @param options - The options for the animation.
     */
    from(startValues:Record<string, any>, options?:Options<A>):void
    {
        options = {...this._defaultOptions, ...options};

        if (options.target === undefined) this._app.throw('target is undefined', []);

        const init = () =>
        {
            const endValues:Record<string, any> = {};
            for (const key in startValues) endValues[key] = options!.target[key];

            return TweenAssistant.#getStartAndEndValues(this._app, startValues, endValues, options!);
        }

        this._queue.push({init, options});

        this.#dequeue();
    }

    /**
     * Animates the target object from the specified start values to the specified end values using the provided options.
     * 
     * @param startValues - The start values for the animation.
     * @param endValues - The end values for the animation.
     * @param options - The options for the animation (optional).
     */
    fromTo(startValues:Record<string, any>, endValues:Record<string, any>, options?:Options<A>):void
    {
        options = {...this._defaultOptions, ...options};

        if (options.target === undefined) this._app.throw('target is undefined', []);

        const init = () => 
        {
            for (const key in startValues) options!.target[key] = startValues[key];

            return TweenAssistant.#getStartAndEndValues(this._app, startValues, endValues, options!);
        };

        this._queue.push({init, options});

        this.#dequeue();
    }

    public abortAll():void
    {
        if (this._activeTween !== undefined) this._activeTween.abort();
        this._queue.length = 0;
    }

    /**
     * Dequeues and executes the next item in the queue.
     * If there are no items in the queue or if there is an active queue item, the function returns early.
     * If autoAbort is enabled and there is an active queue item, it aborts the active queue item.
     * Otherwise, it retrieves the next item from the queue and executes it.
     * The execution involves getting the start and end values, calculating the animation progress,
     * updating the target properties, and invoking the appropriate callbacks.
     * If there is a delay, it waits for the specified delay before starting the animation.
     * Once the animation is complete, it removes the active queue item and calls #dequeue recursively.
     */
    #dequeue():void
    {        
        if (this._queue.length === 0) return;
        if (this._autoAbort === true && this._activeTween !== undefined) return void this._activeTween.abort();
        if (this._activeTween !== undefined) return;
        
        this._activeTween = TweenAssistant.#animate(this._app, this._queue.shift()!, (reason) => 
        {
            switch (reason)
            {
                case 'killed':
                    this._activeTween = undefined;
                    break;
                case 'aborted':
                case 'completed':
                {
                    this._activeTween = undefined;
                    this.#dequeue();
                    break;
                }
            }
        });
    }

    static #animate<A extends IBaseApp<A>>(app:A, item:QueueItem<A>, callback:(reason:'aborted' | 'killed' | 'completed') => void):Tween
    {
        const {init, options} = item;
        const {target, delay, onStart, onComplete, onUpdate, abortController} = options;
        const ease = options.ease ?? easeNone;
        const duration = options.duration || Number.MIN_VALUE;

        const values = init();

        const startTime = Date.now();

        let aborted = abortController?.aborted ?? false;
        const abort = () =>
        {
            abortController?.abort('aborted');
        }

        let killed = false;
        const kill = () =>
        {
            killed = true;
            abortController?.abort('killed');     
        }

        let started = false;
        const animate = () =>
        {
            if (killed === true) 
            {
                callback('killed');
                return;
            }

            if (started === false)
            {
                started = true;
                onStart?.();
            }

            const timeElapsed = Date.now() - startTime;
            const easedProgress = ease(abortController?.aborted === true || aborted === true ? duration : Math.min(duration, timeElapsed), 0, 1, duration);

            for (const key in values) 
            {
                const value = values[key];

                const startValue = value.start;
                const endValue = value.end;
                const result = startValue + (endValue - startValue) * easedProgress;
                target[key] = value.type === 'px' ? `${result}px` : result;
            }

            onUpdate?.(easedProgress);

            if (easedProgress < 1) return requestAnimationFrame(animate);

            onComplete?.();

            callback(abortController?.aborted === true || aborted === true ? 'aborted' : 'completed');
        }

        if (delay === undefined) requestAnimationFrame(animate);
        else setTimeout(() => requestAnimationFrame(animate), delay);

        return {abort, kill};
    }

    /**
     * Performs the "dnit" operation.
     * 
     * @returns A promise that resolves to a boolean indicating whether the operation was successful.
     */
    public override async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        if (this._activeTween !== undefined) this._activeTween.kill();
        this._activeTween = undefined;
        this._queue.length = 0;
        
        return true;
    }
}

/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 *
 * @license
 * 
 * The code from which this code's implementation is derived is licensed under the:
 * 
 * The BSD License.
 *
 * Copyright © 2001 Robert Penner
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 
 * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * Neither the name of the author nor the names of contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
export const easeNone = (t:number, b:number, c:number, d:number, params?:any):number => c * t / d + b;
export const easeInQuad = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d;
    return c * t * t + b;
};

export const easeOutQuad = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d;
    return -c * (t) * (t - 2) + b;
};

export const easeInOutQuad = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d / 2;
    if (t < 1) return c / 2 * t * t + b;
    t--;
    return -c / 2 * (t * (t - 2) - 1) + b;
};

export const easeOutInQuad = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutQuad(t * 2, b, c / 2, d, params);
    return easeInQuad((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInCubic = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d;
    return c * t * t * t + b;
};

export const easeOutCubic = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t = t / d - 1;
    return c * (t * t * t + 1) + b;
};

export const easeInOutCubic = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d / 2;
    if (t < 1) return c / 2 * t * t * t + b;
    t -= 2;
    return c / 2 * (t * t * t + 2) + b;
};

export const easeOutInCubic = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutCubic(t * 2, b, c / 2, d, params);
    return easeInCubic((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInQuart = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d;
    return c * t * t * t * t + b;
};

export const easeOutQuart = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t = t / d - 1;
    return -c * (t * t * t * t - 1) + b;
};

export const easeInOutQuart = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d / 2;
    if (t < 1) return c / 2 * t * t * t * t + b;
    t -= 2;
    return -c / 2 * (t * t * t * t - 2) + b;
};

export const easeOutInQuart = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutQuart(t * 2, b, c / 2, d, params);
    return easeInQuart((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInQuint = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d;
    return c * t * t * t * t * t + b;
};

export const easeOutQuint = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t = t / d - 1;
    return c * (t * t * t * t * t + 1) + b;
};

export const easeInOutQuint = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d / 2;
    if (t < 1) return c / 2 * t * t * t * t * t + b;
    t -= 2;
    return c / 2 * (t * t * t * t * t + 2) + b;
};

export const easeOutInQuint = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutQuint(t * 2, b, c / 2, d, params);
    return easeInQuint((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInSine = (t:number, b:number, c:number, d:number, params?:any):number => -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
export const easeOutSine = (t:number, b:number, c:number, d:number, params?:any):number => c * Math.sin(t / d * (Math.PI / 2)) + b;
export const easeInOutSine = (t:number, b:number, c:number, d:number, params?:any):number => -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;


export const easeOutInSine = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutSine(t * 2, b, c / 2, d, params);
    return easeInSine((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInExpo = (t:number, b:number, c:number, d:number, params?:any):number => t === 0 ? b : c * Math.pow(2, 10 * (t / d - 1)) + b - c * 0.001;
export const easeOutExpo = (t:number, b:number, c:number, d:number, params?:any):number => t === d ? b + c : c * 1.001 * (-Math.pow(2, -10 * t / d) + 1) + b;

export const easeInOutExpo = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t === 0) return b;
    if (t === d) return b + c;
    if ((t /= d / 2) < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b - c * 0.0005;
    return c / 2 * 1.0005 * (-Math.pow(2, -10 * --t) + 2) + b;
};

export const easeOutInExpo = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutExpo(t * 2, b, c / 2, d, params);
    return easeInExpo((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInCirc = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d;
    return -c * (Math.sqrt(1 - t * t) - 1) + b;
};

export const easeOutCirc = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t = t / d - 1;
    return c * Math.sqrt(1 - t * t) + b;
};

export const easeInOutCirc = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    t /= d / 2;
    if (t < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
    t -= 2;
    return c / 2 * (Math.sqrt(1 - t * t) + 1) + b;
};

export const easeOutInCirc = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutCirc(t * 2, b, c / 2, d, params);
    return easeInCirc((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInElastic = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t === 0) return b;
    if ((t /= d) === 1) return b + c;
    const p = params && !isNaN(params.period) ? params.period : d * 0.3;
    let a = params && !isNaN(params.amplitude) ? params.amplitude : 0;
    let s: number;
    if (!a || a < Math.abs(c)) 
    {
        a = c;
        s = p / 4;
    } 
    else s = p / (2 * Math.PI) * Math.asin(c / a);
    
    return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
};

export const easeOutElastic = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t === 0) return b;
    if ((t /= d) === 1) return b + c;
    const p = params && !isNaN(params.period) ? params.period : d * 0.3;
    let a = params && !isNaN(params.amplitude) ? params.amplitude : 0;
    let s:number;
    if (!a || a < Math.abs(c)) 
    {
        a = c;
        s = p / 4;
    } 
    else s = p / (2 * Math.PI) * Math.asin(c / a);
    
    return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
};

export const easeInOutElastic = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t === 0) return b;
    if ((t /= d / 2) === 2) return b + c;
    const p = params && !isNaN(params.period) ? params.period : d * (0.3 * 1.5);
    let a = params && !isNaN(params.amplitude) ? params.amplitude : 0;
    let s:number;
    if (!a || a < Math.abs(c)) 
    {
        a = c;
        s = p / 4;
    }
    else s = p / (2 * Math.PI) * Math.asin(c / a);
    
    if (t < 1) return -0.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
    return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * 0.5 + c + b;
};

export const easeOutInElastic = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutElastic(t * 2, b, c / 2, d, params);
    return easeInElastic((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInBack = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    const s = params && !isNaN(params.overshoot) ? params.overshoot : 1.70158;
    t /= d;
    return c * t * t * ((s + 1) * t - s) + b;
};

export const easeOutBack = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    const s = params && !isNaN(params.overshoot) ? params.overshoot : 1.70158;
    t = t / d - 1;
    return c * (t * t * ((s + 1) * t + s) + 1) + b;
};

export const easeInOutBack = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    let s = params && !isNaN(params.overshoot) ? params.overshoot : 1.70158;
    if ((t /= d / 2) < 1) 
    {
        s *= 1.525;
        return c / 2 * (t * t * ((s + 1) * t - s)) + b;
    }

    t -= 2;
    s *= 1.525;
    return c / 2 * (t * t * ((s + 1) * t + s) + 2) + b;
};

export const easeOutInBack = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutBack(t * 2, b, c / 2, d, params);
    return easeInBack((t * 2) - d, b + c / 2, c / 2, d, params);
};

export const easeInBounce = (t:number, b:number, c:number, d:number, params?:any):number => c - easeOutBounce(d - t, 0, c, d, params) + b;

export const easeOutBounce = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if ((t /= d) < (1 / 2.75)) return c * (7.5625 * t * t) + b;
    if (t < (2 / 2.75)) return c * (7.5625 * (t -= (1.5 / 2.75)) * t + 0.75) + b;
    if (t < (2.5 / 2.75)) return c * (7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375) + b;
    
    return c * (7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375) + b;
};

export const easeInOutBounce = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeInBounce(t * 2, 0, c, d, params) * 0.5 + b;
    return easeOutBounce(t * 2 - d, 0, c, d, params) * 0.5 + c * 0.5 + b;
};

export const easeOutInBounce = (t:number, b:number, c:number, d:number, params?:any):number => 
{
    if (t < d / 2) return easeOutBounce(t * 2, b, c / 2, d, params);
    return easeInBounce((t * 2) - d, b + c / 2, c / 2, d, params);
};
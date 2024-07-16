/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { Field } from "./field/Field.ts";
import type { SpaceOptions } from "./Options.ts";
import type { Performance } from '../../../../../library/managers/IPerformanceManager.ts';

const clamp = (value:number, min:number, max:number):number => Math.min(Math.max(value, min), max);

export class Space
{
    private _fields:Array<Field> = [];

    private _fadeIn?:{frames:number, totalFrames:number};
    private _fadeOut?:{frames:number, totalFrames:number};
    private _opacity:number = 0;

    private _performance:Performance = 2;
    public set performance(value:Performance) { this._performance = value; }
    public get performance() { return this._performance; }

    constructor(canvas:OffscreenCanvas, options:SpaceOptions) 
    {
        this._canvas = canvas;
        this._options = options;
    }

    public add(field:Field)
    {
        this._fields.push(field);
    }

    public fadeIn(frames:number)
    {
        if (this._fadeOut !== undefined) this._fadeOut = undefined;

        this._fadeIn = {frames, totalFrames:frames};
    }

    public fadeOut(frames:number)
    {
        if (this._fadeIn !== undefined) this._fadeIn = undefined;

        this._fadeOut = {frames, totalFrames:frames};
    }

    public update()
    {
        if (this._opacity === 0) return;

        for (const field of this._fields) field.update();
    }

    public draw(force:boolean=false)
    {
        const context = this.context;
        if (context === undefined) return;

        const canvas = this._canvas;

        const fadeIn = this._fadeIn;
        const fadeOut = this._fadeOut;
        if (fadeIn !== undefined)
        {
            const frames = fadeIn.frames--;
            if (frames > 0) 
            {
                context.globalAlpha = 1 - (frames / fadeIn.totalFrames);
                this._opacity = context.globalAlpha;
            }
            else 
            {
                this._fadeIn = undefined;
                this._opacity = 1;
            }
        }
        else if (fadeOut !== undefined)
        {
            const frames = fadeOut.frames--;
            if (frames > 0) 
            {
                context.globalAlpha = frames / fadeOut.totalFrames;
                this._opacity = context.globalAlpha;
            }
            else 
            {
                this._fadeOut = undefined;
                this._opacity = 0;
            }
        }
        else 
        {
            context.globalAlpha = this._opacity;
            
            if (this._performance < 1 && force === false) return;
            if (this._opacity === 0) return;
        }

        const {width, height} = canvas;

        //apply motion blur effect by blending with the previous frame
        const motionBlurIntensity = this.options.motionBlur;
        if (motionBlurIntensity > 0 && this._performance >= 2) 
        {
            context.save();
            context.globalCompositeOperation = 'copy';
            context.globalAlpha = motionBlurIntensity;
            context.drawImage(canvas, 0, 0, width, height); 
            context.restore();
        } 
        else context.clearRect(0, 0, width, height);

        for (const field of this._fields) field.draw(width, height);
    }

    public onResize(width:number, height:number) 
    {
        const canvas = this._canvas;

        const previousWidth = canvas.width;
        const previousHeight = canvas.height;

        if (previousWidth !== width) canvas.width = width;
        if (previousHeight !== height) canvas.height = height;

        for (const field of this._fields) field.onResize(previousWidth, previousHeight, width, height);

        this.draw(true);
    }

    public shift(x:number, y:number) 
    {
        let i = 0;
        let count = this._fields.length;
        for (const field of this._fields)
        {
            const percent = 1 - (i++ / count);

            field.shift(x * percent, y * percent);
        }
    }   
    
    public rotate(degrees:number) 
    {
        let i = 0;
        let count = this._fields.length;
        for (const field of this._fields)
        {
            const percent = 1 - (i++ / count);

            field.rotate(degrees * percent);
        }
    }    
    
    private _canvas:OffscreenCanvas;
    public get canvas() { return this._canvas; }
    
    private _context:OffscreenCanvasRenderingContext2D | undefined;
    public get context() 
    { 
        const context = this._context ?? (this._context = this._canvas.getContext('2d', {willReadFrequently:false, desynchronized:true, alpha:false}) ?? undefined);
        
        //@ts-ignore
        if (context === undefined || ('isContextLost' in context && context.isContextLost() !== false)) return undefined;

        return context
    }

    private _options:SpaceOptions;
    public get options() { return this._options; }

    private _pageX:number = 0;
    public get pageX() { return this._pageX; }
    public set pageX(value:number) { this._pageX = value; }

    private _pageY:number = 0;
    public get pageY() { return this._pageY; }
    public set pageY(value:number) { this._pageY = value; }

    private _beta:number = 0;
    public get beta() { return this._beta; }
    public set beta(value:number) { this._beta = value; }

    private _gamma:number = 0;
    public get gamma() { return this._gamma; }
    public set gamma(value:number) { this._gamma = value; }

    public get isFadeingIn() { return this._fadeIn !== undefined; }
    public get isFadeingOut() { return this._fadeOut !== undefined; }

    public get deviceOrientationX() 
    {
        if (this._options.isMobile !== true) return this._pageX;

        const gamma = clamp(this._gamma, -45, 45);
        return (gamma + 45) * (this._canvas.width / 50);  
    }

    public get deviceOrientationY() 
    { 
        if (this._options.isMobile !== true) return this._pageY;

        const beta = clamp(this._beta, -45, 45);
        return (beta + 45) * (this._canvas.height / 50);  
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { Field } from "../field/Field.ts";
import { Particle } from "./Particle.ts";

export class Star extends Particle
{
    private _twinkle = 0;

    constructor(field:Field, positionWithin?:{min:{x:number, y:number}, max:{x:number, y:number}}) 
    {
        super(field, positionWithin)
    }

    private _rotation:number = 0;
    public override draw(context:OffscreenCanvasRenderingContext2D, canvasWidth:number, canvasHeight:number)
    {        
        const field = this._field;
        const space = field.space;
        const options = field.options;
        const performance = space.performance;
        const sideLength = this._radius;
        
        const x = this._x + this._offsetX;
        const y = this._y + this._offsetY;

        if (x < 0 || x > canvasWidth || y < 0 || y > canvasHeight) return;

        ///if (isLowPowerMode === true)
        ///{
        ///   context.beginPath();
        ///   context.fillStyle = `rgba(${options.color}, ${options.opacity})`;
        ///   context.arc(x, y, sideLength / 2, 0, 2 * Math.PI);
        ///   context.fill();
        ///   return;
        ///}

        const random = Math.random();
        const direction = random < .5 ? -1 : 1; 
        this._rotation += random * .45 * direction;

        context.save();

        //set up shadow properties for halo effect
        context.shadowBlur = 3;//options.haloBlur; //a numeric value indicating the size of the blur effect
        context.shadowColor = `rgba(${options.color}, ${options.opacity})`; //options.haloColor; //a CSS color value for the halo
        context.translate(x, y);
        context.rotate(this._rotation);
        
        let twinkle = this._twinkle--;
        if (twinkle <= 0) this._twinkle = twinkle = random < .05 ? Math.round(random * 60) : 0;
        
        if (twinkle > 0 && performance >= 1) context.fillStyle = `rgba(${options.color}, ${options.opacity * Math.max(.15, random)})`;
        else context.fillStyle = `rgba(${options.color}, ${options.opacity})`;
        
        context.fillRect(-sideLength / 2, -sideLength / 2, sideLength, sideLength);
        
        context.restore();      
    }
}
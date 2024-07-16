/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Field } from "./Field.ts";
import type { IConstellationFieldOptions } from "../Options.ts";
import { Particle } from "../particle/Particle.ts";
import type { Space } from "../Space.ts";

const bigDipperPattern = [
    { x: 0.05, y: 0.22, lineTo: 1 }, //Alkaid
    { x: 0.21, y: 0.25, lineTo: 2 }, //Mizar
    { x: 0.33, y: 0.37, lineTo: 3 }, //Alioth
    { x: 0.45, y: 0.46, lineTo: 4 }, //Megrez
    { x: 0.45, y: 0.55, lineTo: 5 }, //Phecda
    { x: 0.60, y: 0.65, lineTo: 6 }, //Merak
    { x: 0.70, y: 0.55, lineTo: 3 }  //Dubhe
];

export class ConstellationField extends Field
{
    constructor(space:Space, options:IConstellationFieldOptions, createParticle:(field:Field, positionWithin?:{min:{x:number, y:number}, max:{x:number, y:number}}) => Particle) 
    {
        super(space, options, createParticle)
    
        const canvasWidth = space.canvas.width;
        const canvasHeight = space.canvas.height;
    
        for (const position of bigDipperPattern) 
        {
            const scaledX = position.x * (canvasWidth / 4);
            const scaledY = position.y * (canvasHeight / 4);
            const star = createParticle(this, { min: { x: scaledX, y: scaledY }, max: { x: scaledX, y: scaledY } });
            this._particles.push(star);
        }
    }

    public override draw(canvasWidth:number, canvasHeight:number)  
    {
        super.draw(canvasWidth, canvasHeight);

        const context = this._space.context;
        if (context === undefined) return;

        const particles = this._particles;
        const options = this._options as IConstellationFieldOptions;
        context.strokeStyle = 'rgba(' + options.lineColor + ', ' + options.lineOpacity + ')';
        context.lineWidth = options.lineWidth;

        for (let i = 0; i < bigDipperPattern.length; i++)
        {
            const pattern = bigDipperPattern[i];
            
            if (pattern.lineTo === undefined) continue;
            
            const particleFrom = particles[i];
            const particleTo = particles[pattern.lineTo];

            if (particleFrom === undefined || particleTo === undefined) continue;

            context.beginPath();
            context.moveTo(particleFrom.x + particleFrom.offsetX, particleFrom.y + particleFrom.offsetY);
            context.lineTo(particleTo.x + particleTo.offsetX, particleTo.y + particleTo.offsetY);
            context.stroke();

        }
    }
   
    public override onResize(previousWidth:number, previousHeight:number, width:number, height:number) 
    {  
    }
}
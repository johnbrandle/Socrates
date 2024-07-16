/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IFieldOptions } from "../Options.ts";
import { Particle } from "../particle/Particle.ts";
import type { Space } from "../Space.ts";

export abstract class Field 
{
    protected _createParticle:(field:Field, positionWithin?:{min:{x:number, y:number}, max:{x:number, y:number}}) => Particle;

    constructor(space:Space, options:IFieldOptions, createParticle:(field:Field, positionWithin?:{min:{x:number, y:number}, max:{x:number, y:number}}) => Particle) 
    {
        this._space = space;
        this._options = options;
        this._createParticle = createParticle;
    }

    public update()
    {
        for (const particle of this._particles) particle.update();
    }

    public draw(canvasWidth:number, canvasHeight:number) 
    {
        const context = this._space.context;
        if (context === undefined) return;

        for (const particle of this._particles)
        {
            particle.update();
            particle.draw(context, canvasWidth, canvasHeight);
        }
    }

    public abstract onResize(previousWidth:number, previousHeight:number, width:number, height:number):void;

    public shift(x:number, y:number) 
    {
        //shift particle positions and reposition those outside the canvas
        const space = this._space;
        const canvas = space.canvas;
        const width = canvas.width;
        const height = canvas.height;

        for (const particle of this._particles)
        {
            const currentX = particle.x;
            const currentY = particle.y;

            let proposedX = currentX + x;
            let proposedY = currentY + y;

            if (proposedX < 0) proposedX = width + proposedX;
            else if (proposedX > width) proposedX = proposedX - width;

            if (proposedY < 0) proposedY = height + proposedY;
            else if (proposedY > height) proposedY = proposedY - height;

            particle.x = proposedX;
            particle.y = proposedY;
        }
    }   
    
    public rotate(degrees:number) 
    {
        const space = this._space;
        const canvas = space.canvas;
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radians = degrees * Math.PI / 180;
    
        for (const particle of this._particles) 
        {
            //calculate the current position relative to the center
            const relativeX = particle.x - centerX;
            const relativeY = particle.y - centerY;
    
            //calculate the distance and angle from the center
            const distance = Math.sqrt(relativeX * relativeX + relativeY * relativeY);
            const currentAngle = Math.atan2(relativeY, relativeX);
    
            //calculate the new angle
            const newAngle = currentAngle + radians;
    
            //calculate the new position
            particle.x = centerX + distance * Math.cos(newAngle);
            particle.y = centerY + distance * Math.sin(newAngle);
    
            //handle boundary conditions by wrapping around
            if (particle.x < 0) particle.x += width;
            else if (particle.x > width) particle.x -= width;
    
            if (particle.y < 0) particle.y += height;
            else if (particle.y > height) particle.y -= height;
        }
    }    
    
    protected _particles:Array<Particle> = [];
    public get particles() { return this._particles; }

    protected _space:Space;
    public get space() { return this._space; }

    protected _options:IFieldOptions;
    public get options() { return this._options; }
}
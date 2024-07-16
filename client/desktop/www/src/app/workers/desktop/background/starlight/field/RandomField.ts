/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IRandomFieldOptions } from "../Options.ts";
import { Particle } from "../particle/Particle.ts";
import type { Space } from "../Space.ts";
import { Field } from "./Field.ts";

export class RandomField extends Field
{
    constructor(space:Space, options:IRandomFieldOptions, createParticle:(field:Field, positionWithin?:{min:{x:number, y:number}, max:{x:number, y:number}}) => Particle) 
    {
        super(space, options, createParticle);

        const canvas = space.canvas;
        const particles = this._particles;
        const count = Math.round((canvas.width * canvas.height) / this._options.density);
        for (let i = 0; i < count; i++) particles.push(createParticle(this));
    }

    public override onResize(previousWidth:number, previousHeight:number, width:number, height:number) 
    {
        const particles = this._particles;
        const getNewParticle = this._createParticle;

        const newParticleCount = Math.round((width * height) / this._options.density);
        if (newParticleCount > particles.length) //we scaled up
        {
            const positionWithin = {min:{x:previousWidth, y:previousHeight}, max:{x:width, y:height}};

            for (; newParticleCount > particles.length;) particles.push(getNewParticle(this, positionWithin));
        } 
        else if (newParticleCount < particles.length) //we scaled down
        {   
            const newParticles = [];
            for (const particle of particles)
            {
                const x = particle.x;
                if (x > width || x < 0) continue;
                
                const y = particle.y;
                if (y > height || y < 0) continue;
                
                newParticles.push(particle);
            }

            this._particles = newParticles;
        }
    }    
}
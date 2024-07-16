/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { Field } from "../field/Field.ts";

const getRandomFloat = (min: number, max: number) => Math.random() * (max - min) + min;
const generateDeadZoneValue = (options:{center:number, range:number, deadZone:number}):number =>
{
    //generate a random value within the specified range around the center
    let randomValue = options.center - options.range / 2 + Math.random() * options.range;
    
    //adjust the value to ensure it does not fall within the dead zone
    if (randomValue > options.center) randomValue += options.deadZone;
    else randomValue -= options.deadZone;

    return randomValue;
}

export abstract class Particle 
{
    protected _field:Field;
    
    protected _radius = 0;

    constructor(field:Field, positionWithin?:{min:{x:number, y:number}, max:{x:number, y:number}}) 
    {
        this._field = field;
        
        const particleGroundWidth = field.space.canvas.width
        const particleGroundHeight = field.space.canvas.height;

        const minX = positionWithin?.min.x ?? 0;
        const minY = positionWithin?.min.y ?? 0;
        const maxX = positionWithin?.max.x ?? particleGroundWidth;
        const maxY = positionWithin?.max.y ?? particleGroundHeight;

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        if (sizeX > 0 && sizeY > 0) //distribute the particle based on the ratio of the available space
        {
            //calculate the proportional distribution factor
            const distributionFactor = sizeX / (sizeX + sizeY);

            if (Math.random() < distributionFactor) 
            {
                //more likely to be in the width area
                this._x = getRandomFloat(minX, maxX);
                this._y = getRandomFloat(0, particleGroundHeight);
            } 
            else 
            {
                //more likely to be in the height area
                this._x = getRandomFloat(0, particleGroundWidth);
                this._y = getRandomFloat(minY, maxY);
            }
        }
        else if (sizeX > 0) 
        {
            this._x = getRandomFloat(minX, maxX);
            this._y = getRandomFloat(0, particleGroundHeight);
        }
        else if (sizeY > 0) 
        {
            this._x = getRandomFloat(0, particleGroundWidth);
            this._y = getRandomFloat(minY, maxY);
        }
        else 
        {
            this._x = positionWithin!.min.x; //exact location
            this._y = positionWithin!.min.y; //exact location
        }
        
        const options = field.options;

        const radius = options.radius;
        this._radius = getRandomFloat(radius.min, radius.max);

        const speed = options.speed;
        this._speedX = generateDeadZoneValue({center:0, range:speed.max, deadZone:speed.min});
        this._speedY = generateDeadZoneValue({center:0, range:speed.max, deadZone:speed.min});
    }

    public update() 
    {
        const field = this._field;
        const space = field.space;
        const canvas = space.canvas;
        const options = field.options;
        const radius = this._radius;
        const width = canvas.width;
        const height = canvas.height;
        
        {
            const offsetX = this._offsetX;
            const offsetY = this._offsetY;

            const parallaxFactor = 1 / options.parallax;
            const adjustedParallax = parallaxFactor / radius; //the larger the radius, the more parallax

            const parallaxX = (space.deviceOrientationX - width / 2) / adjustedParallax;
            const parallaxY = (space.deviceOrientationY - height / 2) / adjustedParallax;

            this._offsetX += (parallaxX - offsetX) / 10;
            this._offsetY += (parallaxY - offsetY) / 10;
        }

        const x = this._x;
        const y = this._y;

        {
            const speedX = this._speedX;
            const speedY = this._speedY;
            const offsetX = this._offsetX;
            const offsetY = this._offsetY;

            const calculatedX = x + speedX + offsetX;
            const calculatedY = y + speedY + offsetY;
            if (calculatedX > width || calculatedX < 0) this._speedX = -speedX;
            if (calculatedY > height || calculatedY < 0) this._speedY = -speedY;
        }

        this._x += this._speedX;
        this._y += this._speedY;
    }

    public abstract draw(context:OffscreenCanvasRenderingContext2D, canvasWidth:number, canvasHeight:number):void;

    protected _x = 0;
    public get x():number { return this._x; }
    public set x(value:number) { this._x = value; }

    protected _y = 0;
    public get y():number { return this._y; }
    public set y(value:number) { this._y = value; }

    private _speedX = 0;
    public get speedX():number { return this._speedX; }

    private _speedY = 0;
    public get speedY():number { return this._speedY; }

    protected _offsetX = 0;
    public get offsetX():number { return this._offsetX; }

    protected _offsetY = 0;
    public get offsetY():number { return this._offsetY; }
}
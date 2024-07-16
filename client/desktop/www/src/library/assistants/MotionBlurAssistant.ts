/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DestructableEntity } from '../../../../../../shared/src/library/entity/DestructableEntity';
import type { IBaseApp } from '../IBaseApp';
import type { IDestructor } from '../../../../../../shared/src/library/IDestructor';
import { Performance } from '../managers/IPerformanceManager';
import { ResolvePromise } from '../../../../../../shared/src/library/promise/ResolvePromise';
import { easeOutSine, TweenAssistant } from './TweenAssistant';

type Transform = {scale:number; angle:number; xOffset:number; yOffset:number};

export class MotionBlurAssistant<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private _element:HTMLElement;
    private _lastTransform:Transform = {scale:-1, angle:-1, xOffset:-1, yOffset:-1};
    private _motionBlur:number;

    private _clonedElements:HTMLElement[] = [];
    private _clonedElementTransforms:Transform[] = [];

    private _performance!:Performance;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, motionBlur:number=3)
    {
        super(app, destructor);

        this._element = element;
        this._motionBlur = motionBlur;
    }

    public start()
    {
        if (this._performance < Performance.High) return;

        const element = this._element;
        const elementParent = element.parentElement;
        for (let i = this._motionBlur; i--;)
        {
            const clonedElement = this._app.domUtil.clone(element);
            elementParent!.insertBefore(clonedElement, element);
            clonedElement.style.pointerEvents = 'none';
            clonedElement.style.opacity = (i + 1) / (this._motionBlur * 1.5) + '';

            this._clonedElements.push(clonedElement);
            this._clonedElementTransforms.push({scale:1, angle:0, xOffset:0, yOffset:0});
        }
    }

    public transform(scale:number, angle:number, xOffset:number, yOffset:number)
    {
        if (this._performance < Performance.High)
        {
            this._element.style.transform = `scale(${scale}) rotate(${angle}deg) translate(${xOffset}px, ${yOffset}px)`;
            return;
        }

        const deltaX = xOffset - this._lastTransform.xOffset;
        const deltaY = yOffset - this._lastTransform.yOffset;
        const clonedElements = this._clonedElements;
        const motionBlur = this._motionBlur;

        if (this._lastTransform.scale !== -1)
        {
            for (let i = 0; i < motionBlur; i++) 
            {
                const clonedElement = clonedElements[i];
                const step = i + .05; 
                const stepScale = 1 - ((i + 1) * .004); 
                clonedElement.style.transform = `scale(${stepScale * scale}) rotate(${angle}deg) translate(${xOffset - deltaX * step}px, ${yOffset - deltaY * step}px)`;

                //update cloned transform parameters
                const clonedElementTransform = this._clonedElementTransforms[i];
                clonedElementTransform.scale = stepScale * scale;
                clonedElementTransform.angle = angle;
                clonedElementTransform.xOffset = xOffset - deltaX * step;
                clonedElementTransform.yOffset = yOffset - deltaY * step;
            }
        }

        this._element.style.transform = `scale(${scale}) rotate(${angle}deg) translate(${xOffset}px, ${yOffset}px)`;

        //update last transform parameters
        this._lastTransform = {scale, angle, xOffset, yOffset};
    }  

    public async end(duration:number=300):Promise<void>
    {
        if (this._performance < Performance.High) return;

        const promise = new ResolvePromise<void>();

        const clonedElements = this._clonedElements;
        const lastTransform = this._lastTransform;

        let completed = 0;
        const length = clonedElements.length;
        for (let i = 0; i < length; i++) 
        {
            const clonedElement = clonedElements[i];
            const clonedElementTransform = this._clonedElementTransforms[i];
            
            //animate each cloned element to match the original element's transform
            const dummy = {percent:0, opacity:parseFloat(clonedElement.style.opacity)};
            TweenAssistant.to(this._app, {percent:1, opacity:0}, {target:dummy, duration, onUpdate:() =>
            {
                const percent = dummy.percent;
                
                clonedElement.style.transform = `scale(${clonedElementTransform.scale + (lastTransform.scale - clonedElementTransform.scale) * percent}) rotate(${clonedElementTransform.angle + (lastTransform.angle - clonedElementTransform.angle) * percent}deg) translate(${clonedElementTransform.xOffset + (lastTransform.xOffset - clonedElementTransform.xOffset) * percent}px, ${clonedElementTransform.yOffset + (lastTransform.yOffset - clonedElementTransform.yOffset) * percent}px)`;
                clonedElement.style.opacity = dummy.opacity.toString();
            }, onComplete:() => 
            {
                clonedElement.remove();
                
                if (++completed < length) return;

                promise.resolve();
            }, ease:easeOutSine});
        }

        clonedElements.length = 0;
        this._lastTransform = {scale:-1, angle:-1, xOffset:-1, yOffset:-1};

        return promise;
    }
}

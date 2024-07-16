/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DestructableEntity } from "../../../../../../../../../shared/src/library/entity/DestructableEntity";
import { MotionBlurAssistant } from "../../../../../library/assistants/MotionBlurAssistant";
import { easeOutQuad } from "../../../../../library/assistants/TweenAssistant";
import type { IView } from "../../../../../library/components/view/IView";
import type { IViewer } from "../../../../../library/components/view/IViewer";
import { ITransitionEffectType, type ITransitionEffect } from "../../../../../library/components/view/transition/ITransitionEffect";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IBaseApp } from "../../../../../library/IBaseApp";
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";

@ImplementsDecorator(ITransitionEffectType)
export class CustomSlide<A extends IBaseApp<A>> extends DestructableEntity<A> implements ITransitionEffect<A>
{
    private _viewer!:IViewer<A>;
    private _fromView!:IView<A>;
    private _toView!:IView<A>;

    private _map:{[key:string]:number} = {};

    private _beforeTweenValues = 
    {
        fromView:
        {
            position:'', 
            left:'', 
            width:'', 
            height:'', 
            display:'',
            overflow:'',
            transform:'', 
            transformOrigin:''
        }, 
        toView:
        {
            position:'', 
            left:'', 
            width:'', 
            height:'', 
            display:'',
            overflow:'',
            transform:'', 
            transformOrigin:''
        }
    };

    private _direction!:number;

    private _size!:number;
    private _rotationAngle!:number;

    private _scaleValue:number = 1;
    private _rotationValue:number = 0;

    private _fromViewFinalPosition:{x:number, y:number} = {x:0, y:0};
    private _toViewInitialPosition:{x:number, y:number} = {x:0, y:0};

    private _previousPercent = 0;

    private _fromAnimationAssistant?:MotionBlurAssistant<A>;
    private _toAnimationAssistant?:MotionBlurAssistant<A>;

    public constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }
    
    public async before(viewer:IViewer<A>, fromView:IView<A>, toView:IView<A>):Promise<void> 
    {
        this._viewer = viewer;
        this._fromView = fromView;
        this._toView = toView;

        this._direction = fromView.index < toView.index ? -1 : 1;

        this._beforeTweenValues = 
        {
            fromView:
            {
                position:fromView.element.style.position, 
                left:fromView.element.style.left, 
                width:fromView.element.style.width, 
                height:fromView.element.style.height, 
                display:fromView.element.style.display,
                overflow:fromView.element.style.overflow,
                transform:fromView.element.style.transform, 
                transformOrigin:fromView.element.style.transformOrigin
            },
            toView:
            {
                position:toView.element.style.position, 
                left:toView.element.style.left, 
                width:toView.element.style.width, 
                height:toView.element.style.height, 
                display:toView.element.style.display,
                overflow:toView.element.style.overflow,
                transform:toView.element.style.transform, 
                transformOrigin:toView.element.style.transformOrigin
            }
        }; 

        const width = viewer.element.offsetWidth;
        const height = viewer.element.offsetHeight;
        const size = Math.max(width, height);

        this._size = size;

        //set the display to block so the width and height have an effect
        toView.element.style.display = 'block';
        fromView.element.style.display = 'block';

        //set the width and heights so they stay the same during the transition
        toView.element.style.width = width + 'px';
        toView.element.style.height = height + 'px';
        fromView.element.style.width = width + 'px';
        fromView.element.style.height = height + 'px';

        //set the overflow to hidden so the component content doesn't show outside the view area
        toView.element.style.overflow = 'hidden';
        fromView.element.style.overflow = 'hidden';

        //set the position to fixed so the views don't cause any issues as they move around
        toView.element.style.position = 'fixed';
        fromView.element.style.position = 'fixed'; 

        let transformOriginXOffset;
        let transformOriginYOffset;

        //calculate transform origin offsets based on the position of the actual visual content
        {
            const content = toView.element.querySelector('.component-content')?.firstElementChild as HTMLElement ?? toView.element;

            let viewRect = toView.element.getBoundingClientRect();
            //get the center position of the view
            let viewCenterX = viewRect.left + viewRect.width / 2;
            let viewCenterY = viewRect.top + viewRect.height / 2;

            let contentRect = content.getBoundingClientRect();
            //get the center position of the component content
            let contentCenterX = contentRect.left + contentRect.width / 2;
            let contentCenterY = contentRect.top + contentRect.height / 2;

            transformOriginXOffset = contentCenterX - viewCenterX;
            transformOriginYOffset = contentCenterY - viewCenterY;
        }
        toView.element.style.transformOrigin =  `calc(50% + ${transformOriginXOffset}px) calc(50% + ${transformOriginYOffset}px)`;
        toView.element.style.transform = 'scale(1)'; 
        
        //calculate transform origin offsets based on the position of the actual visual content
        {
            const content = fromView.element.querySelector('.component-content')?.firstElementChild as HTMLElement ?? fromView.element;

            let viewRect = fromView.element.getBoundingClientRect();
            //get the center position of the view
            let viewCenterX = viewRect.left + viewRect.width / 2;
            let viewCenterY = viewRect.top + viewRect.height / 2;

            let contentRect = content.getBoundingClientRect();
            //get the center position of the component content
            let contentCenterX = contentRect.left + contentRect.width / 2;
            let contentCenterY = contentRect.top + contentRect.height / 2;

            transformOriginXOffset = contentCenterX - viewCenterX;
            transformOriginYOffset= contentCenterY - viewCenterY;
        }
        fromView.element.style.transformOrigin = `calc(50% + ${transformOriginXOffset}px) calc(50% + ${transformOriginYOffset}px)`;
         
        let transisitionID1 = fromView.uid + '_' + toView.uid;
        let transisitionID2 = toView.uid + '_' + fromView.uid;

        if (this._map[transisitionID1] !== undefined) this._rotationAngle = this._map[transisitionID1];
        else
        {
            //calculate a random rotation angle, e.g., between -45 and 45 degrees
            const allowedAngles = [0];//[0, 90];//[0, 33, 66, 90];
            this._rotationAngle = this._app.arrayUtil.getRandomValue(allowedAngles) * -this._direction;

            this._map[transisitionID1] = this._rotationAngle;
            this._map[transisitionID2] = -this._rotationAngle;
        }

        //calculate the initial positions based on the rotation angle
        const radians = ((this._rotationAngle) * -this._direction) * Math.PI / 180;
        const xPosition = Math.cos(radians) * (this._size * 1.5) * -this._direction;
        const yPosition = Math.sin(radians) * (this._size * 1.5) * -this._direction;

        this._toViewInitialPosition = {x:xPosition, y:yPosition};
        this._fromViewFinalPosition = {x:-xPosition, y:-yPosition};

        //set the initial position of toView
        toView.element.style.transform = `translate(${this._toViewInitialPosition.x}px, ${this._toViewInitialPosition.y}px) scale(1) rotate(0deg)`;

        //fromView.element.style.border = '1px solid red';
        //toView.element.style.border = '1px solid red'; 

        this._fromAnimationAssistant = new MotionBlurAssistant(this._app, this, fromView.element, 3);
        this._fromAnimationAssistant.start();

        this._toAnimationAssistant = new MotionBlurAssistant(this._app, this, toView.element, 3);
        this._toAnimationAssistant.start();
    }

    public during(percent:number):void 
    {
        const fromView = this._fromView;
        const toView = this._toView;

        const normalizePercent = (currentPercent:number, startPercent:number, endPercent:number):number => 
        {
            if (currentPercent < startPercent) return 0;
            if (currentPercent > endPercent) return 1; 
            
            return (currentPercent - startPercent) / (endPercent - startPercent);
        }
        
        const applyTransformations = (element:HTMLElement, scale:number, angle:number, xOffset:number, yOffset:number) => 
        {
            element.style.transform = `translate(${xOffset}px, ${yOffset}px) scale(${scale}) rotate(${angle}deg)`;
            
            if (percent < .33)
            {
                let blurPercent = normalizePercent(percent, 0, .33);
                element.style.filter = `blur(${blurPercent * 1}px)`;
            }
            else if (percent > .98)
            {
                let blurPercent = normalizePercent(percent, .98, 1);
                element.style.filter = `blur(${(1 - blurPercent) * 1}px)`;
            }
            else
            {
                element.style.filter = `blur(1px)`;
            }
        };

        let scaleValue = this._scaleValue;
        let rotationValue = this._rotationValue;

        //if percent is less than .40 rotate the view
        if (percent < .40)
        {
            const normalizedPercent = normalizePercent(percent, 0, .40);

            const rotationAngle = Math.abs(this._rotationAngle) >= 90 ? (Math.abs(this._rotationAngle) - 90) * this._direction : this._rotationAngle;

            rotationValue = normalizedPercent * rotationAngle;
        }

        //if percent is less than .35 scale down by 15%
        if (percent < .35)
        {
            const normalizedPercent = normalizePercent(percent, 0, .35);

            scaleValue = 1 - (0.15 * normalizedPercent);
        }

        //if percent is between .70 and .98 scale up by 15%
        if (percent > .70 && percent < .98)
        {
            const normalizedPercent = normalizePercent(percent, .70, .98);

            scaleValue = .85 + (0.15 * normalizedPercent); 
        }

        //if percent is above .80 rotate the view back to 0
        if (percent > .80)
        {
            const normalizedPercent = normalizePercent(percent, .80, 1);

            const rotationAngle = Math.abs(this._rotationAngle) >= 90 ? (Math.abs(this._rotationAngle) - 90) * this._direction : this._rotationAngle;

            rotationValue = (1 - normalizedPercent) * rotationAngle;
        }

        const fromViewFinalPosition = this._fromViewFinalPosition;
        
        let previousX = fromViewFinalPosition.x * this._previousPercent;
        let previousY = fromViewFinalPosition.y * this._previousPercent;
        
        let positionX = fromViewFinalPosition.x * percent;
        let positionY = fromViewFinalPosition.y * percent;

        let deltaX = positionX - previousX;
        let deltaY = positionY - previousY;

        this._fromAnimationAssistant!.transform(scaleValue, rotationValue, positionX, positionY);
        //applyTransformations(fromView.element, scaleValue, rotationValue, positionX, positionY); 

        const toViewInitialPosition = this._toViewInitialPosition;
        positionX = toViewInitialPosition.x * (1 - percent);
        positionY = toViewInitialPosition.y * (1 - percent); 
        this._toAnimationAssistant!.transform(scaleValue, rotationValue, positionX, positionY);
        //applyTransformations(toView.element, scaleValue, rotationValue, positionX, positionY);
 
        //this._app.environment.progress.shift(-deltaX, -deltaY); 
        //this._app.environment.progress.rotate(this._rotationValue - rotationValue);

        this._rotationValue = rotationValue;
        this._scaleValue = scaleValue;
         
        this._previousPercent = percent;
    }

    public async after():Promise<void> 
    {
        const promises = [];
        promises.push(this._fromAnimationAssistant!.end());
        promises.push(this._toAnimationAssistant!.end());

        await Promise.all(promises);

        const fromView = this._fromView;
        const toView = this._toView;
        const beforeTweenValues = this._beforeTweenValues;

        //@ts-ignore
        for (const property in beforeTweenValues.fromView) fromView.element.style[property] = beforeTweenValues.fromView[property];
        //@ts-ignore
        for (const property in beforeTweenValues.toView) toView.element.style[property] = beforeTweenValues.toView[property];
    }

    get easing():((t:number, b:number, c:number, d:number, params?:any) => number) { return easeOutQuad; }
}
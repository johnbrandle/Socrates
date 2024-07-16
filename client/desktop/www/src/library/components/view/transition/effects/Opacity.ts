/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { ITransitionEffect } from "../ITransitionEffect";
import { ITransitionEffectType } from "../ITransitionEffect";
import type { IView } from "../../IView";
import type { IViewer } from "../../IViewer";
import type { IBaseApp } from "../../../../IBaseApp";
import { DestructableEntity } from "../../../../../../../../../shared/src/library/entity/DestructableEntity";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import { easeInOutSine } from "../../../../assistants/TweenAssistant";
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";

const normalizePercent = (currentPercent:number, startPercent:number, endPercent:number):number => 
{
    if (currentPercent < startPercent) return 0;
    if (currentPercent > endPercent) return 1; 
    
    return (currentPercent - startPercent) / (endPercent - startPercent);
}

@ImplementsDecorator(ITransitionEffectType)
export class Opacity<A extends IBaseApp<A>> extends DestructableEntity<A> implements ITransitionEffect<A>
{
    private _fromView!:IView<A>;
    private _toView!:IView<A>;

    private _beforeTweenValues = {fromView:{position:''}, toView:{position:'', opacity:'', zIndex:''}};
    
    public constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }
    
    public async before(_viewer:IViewer<A>, fromView:IView<A>, toView:IView<A>):Promise<void> 
    {
        this._fromView = fromView;
        this._toView = toView;

        this._beforeTweenValues = 
        {
            fromView:{position:fromView.element.style.position},
            toView:{position:toView.element.style.position, opacity:toView.element.style.opacity, zIndex:toView.element.style.zIndex}
        };

        fromView.element.style.position = 'fixed';

        toView.element.style.position = 'fixed';
        toView.element.style.opacity = '0';
        toView.element.style.zIndex = '1';
    }

    public during(percent:number):void 
    {
        if (percent < .5)
        {
            const normalizedPercent = normalizePercent(percent, 0, .5);
            this._fromView.element.style.opacity = String(1 - normalizedPercent);
        }
        else 
        {
            const normalizedPercent = normalizePercent(percent, .5, 1);
            this._toView.element.style.opacity = String(normalizedPercent);
        }
    }

    public async after():Promise<void> 
    {
        const fromView = this._fromView;
        const toView = this._toView;
        const beforeTweenValues = this._beforeTweenValues;

        //@ts-ignore
        for (const property in beforeTweenValues.fromView) fromView.element.style[property] = beforeTweenValues.fromView[property];
        //@ts-ignore
        for (const property in beforeTweenValues.toView) toView.element.style[property] = beforeTweenValues.toView[property];
    }

    get easing():((t:number, b:number, c:number, d:number, params?:any) => number) | undefined { return easeInOutSine; }
}
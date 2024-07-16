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
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";

@ImplementsDecorator(ITransitionEffectType)
export class None<A extends IBaseApp<A>> extends DestructableEntity<A> implements ITransitionEffect<A>
{
    private _fromView!:IView<A>;
    private _toView!:IView<A>;

    private _beforeTweenValues = {toView:{opacity:''}, fromView:{display:''}};

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
            toView:{opacity:toView.element.style.opacity},
            fromView:{display:fromView.element.style.display},
        };

        toView.element.style.opacity = '0';
        fromView.element.style.display = 'none';
    }
    public during(_percent:number):void {}
    public async after():Promise<void> 
    {
        const toView = this._toView;
        const beforeTweenValues = this._beforeTweenValues;

        toView.element.style.opacity = beforeTweenValues.toView.opacity;
        this._fromView.element.style.display = beforeTweenValues.fromView.display;
    }

    get easing():((t:number, b:number, c:number, d:number, params?:any) => number) | undefined { return undefined; }
}
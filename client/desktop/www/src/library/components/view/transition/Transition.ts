/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from '../../../IBaseApp.ts';
import type { ITransition } from './ITransition.ts';
import type { IView } from '../IView.ts';
import type { IViewer } from '../IViewer.ts';
import { ITransitionType } from './ITransition.ts';
import { IViewerType } from '../IViewer.ts';
import { __ViewAttributes } from '../__internal/__attributes.ts';
import { ITransitionEffectType, type ITransitionEffect } from './ITransitionEffect.ts';
import { None } from './effects/None.ts';
import { DestructableEntity } from '../../../../../../../../shared/src/library/entity/DestructableEntity.ts';
import { TweenAssistant, easeNone } from '../../../assistants/TweenAssistant.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';
import { Performance } from '../../../managers/IPerformanceManager.ts';
import { ImplementsDecorator } from '../../../../../../../../shared/src/library/decorators/ImplementsDecorator.ts';

export enum TransitionState
{
    FromBefore = 0,
    FromAfter = 1,
    ToBefore = 2,
    ToAfter = 3,
}

@ImplementsDecorator(ITransitionType)
export class Transition<A extends IBaseApp<A>> extends DestructableEntity<A> implements ITransition<A> 
{
    private _baseView:IView<A>;
    protected _viewToTransitionToAfter?:IView<A>;

    protected _transitioning = false;

    private _transitionEffect:ITransitionEffect<A>;
    public get effect() { return this._transitionEffect; }

    private _duration = 0;
    public get duration() { return this._duration; }
    
    constructor(app:A, destructor:IDestructor<A>, view:IView<A>) 
    {
        super(app, destructor);

        this._baseView = view.base;

        this._duration = parseFloat(view.element.getAttribute(__ViewAttributes.Duration) ?? '0') || 0;

        const effect = view.element.getAttribute(__ViewAttributes.Effect) ?? undefined;
        this._transitionEffect = (effect !== undefined) ? this._app.instanceManager.parse<ITransitionEffect<A>>(this, effect, {type:ITransitionEffectType}) ?? new None(this._app, this) : new None(this._app, this);
    }

    public async goto(transitionToView:IView<A>, ..._args:any):Promise<void>
    {
        if (this._transitioning === true) 
        {
            const parentViewer = transitionToView.viewer;
            let queue = parentViewer?.element.hasAttribute(__ViewAttributes.Queue) ?? false;
            
            if (parentViewer !== undefined && queue === false && parentViewer.element.hasAttribute(__ViewAttributes.Queue) === false && this._app.typeUtil.is<IViewer<any>>(this._baseView, IViewerType) === false) queue = this._baseView.element.hasAttribute(__ViewAttributes.Queue);
            if (queue === true) this._viewToTransitionToAfter = transitionToView;
            
            return;
        }
        
        this._transitioning = true;
        const {view, viewer} = await this.#getTransitioning(transitionToView);
       
        //if the view is undefined, return
        if (viewer === undefined) return void (this._transitioning = false); 

        //if the view is already the current view, return
        if (viewer.current === view) return void (this._transitioning = false);

        //if the view is not within the viewer, throw an error
        if (viewer.contains(view) !== true) 
        {
            this._transitioning = false;

            this._app.throw('view is not within viewer', [view, viewer], {correctable:true});
        }

        const transitionEffect = this.#getTransitionEffect(viewer);
        const duration = this.#getDuration(viewer);

        //do the transition
        await this.doTransition(transitionEffect, duration, viewer, viewer.current, view);

        //if there is a view to transition to after, transition to it; otherwise, return
        if (this._viewToTransitionToAfter === undefined) return;
            
        const afterView = this._viewToTransitionToAfter;
        this._viewToTransitionToAfter = undefined;

        //transition to the view
        return this.goto(afterView);
    }

    #getTransitionEffect(viewer:IViewer<A>):ITransitionEffect<A>
    {
        let eachViewer:IViewer<A> | undefined = viewer;
        while (eachViewer !== undefined)
        {
            if (eachViewer.transition !== undefined) break;
            
            eachViewer = eachViewer.viewer;
        }

        return eachViewer?.transition?.effect ?? this._transitionEffect;
    }

    #getDuration(viewer:IViewer<A>):number
    {
        let eachViewer:IViewer<A> | undefined = viewer;
        while (eachViewer !== undefined)
        {
            if (eachViewer.transition !== undefined) break;
            
            eachViewer = eachViewer.viewer;
        }

        return eachViewer?.transition?.duration ?? this._duration;
    }

    protected async doTransition(transitionEffect:ITransitionEffect<A> | undefined, duration:number, viewer:IViewer<A>, fromView:IView<A>, toView:IView<A>):Promise<void> 
    {
        if (this._app.performanceManager.recommended <= Performance.Low || transitionEffect === undefined) //if performance is low, or no transition effect is specified, do an immediate transition
        {
            await toView.load();

            fromView.__onTransition(TransitionState.FromBefore);
            toView.__onTransition(TransitionState.ToBefore);
            
            await viewer.setCurrent(toView);
            
            fromView.__onTransition(TransitionState.FromAfter);
            toView.__onTransition(TransitionState.ToAfter);
            
            this._transitioning = false;
            
            return;
        }

        await toView.load();
 
        fromView.__onTransition(TransitionState.FromBefore);
        toView.__onTransition(TransitionState.ToBefore);

        viewer.__current = toView;
        await transitionEffect.before(viewer, fromView, toView);

        //using TweenMax with a dummy object for progress tracking
        const dummy = {progress:0};
        return new Promise((resolve, _reject) => 
        {
            TweenAssistant.to(this._app, {progress:1}, {target:dummy, duration, ease:transitionEffect.easing ?? easeNone, onUpdate:() => transitionEffect.during(dummy.progress), onComplete:async () =>
            {
                await transitionEffect.after();
                    
                if (fromView.element.hasAttribute(__ViewAttributes.NoUnload) !== true) await fromView.unload();
                this._transitioning = false;

                fromView.__onTransition(TransitionState.FromAfter);
                toView.__onTransition(TransitionState.ToAfter);

                resolve(); //resolve the promise when the animation completes
            }})
        });
    }

    async #getTransitioning(transitioningToView:IView<A>):Promise<{view:IView<A>, viewer:IViewer<A> | undefined}>
    {
        let child = transitioningToView;
        let parent = transitioningToView.parent;

        while (parent !== undefined) 
        {
            //continue if the parent is not a viewer
            if (this._app.typeUtil.is<IViewer<any>>(parent, IViewerType) === false)
            {
                //set the child to the parent
                child = parent;
                parent = child.parent;
                
                continue;
            }
            
            //if viewer is loaded or if the viewer contains the transitioningToView and the base is not loaded, break
            if (parent.loaded === true || (parent.contains(transitioningToView) === true && parent.base.loaded === false)) break;

            //set the child to current
            if (parent.current !== child) await parent.setCurrent(child);
            
            //set the child to the parent
            child = parent;
            parent = child.parent;
        }

        if (child === undefined) this._app.throw('view is undefined', [child, parent], {correctable:true});

        return {view:child, viewer:parent};
    }
}
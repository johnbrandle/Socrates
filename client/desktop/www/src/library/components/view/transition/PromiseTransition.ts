/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from '../../../IBaseApp.ts';
import type { IView } from '../IView.ts';
import type { IViewer } from '../IViewer.ts';
import type { ITransitionEffect } from './ITransitionEffect.ts';
import { None } from './effects/None.ts';
import { Transition } from './Transition.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';

export class PromiseTransition<A extends IBaseApp<A>> extends Transition<A>
{
    private _promise:(() => Promise<any>) | Promise<any> | undefined;

    constructor(app:A, destructor:IDestructor<A>, view:IView<A>) 
    {
        super(app, destructor, view);
    }

    public override async goto(transitioningToView:IView<A>, promise:(() => Promise<any>) | Promise<any>):Promise<void>
    {
        this._promise = promise;

        return super.goto(transitioningToView);
    }

    protected override async doTransition(tween:ITransitionEffect<A> | undefined, duration:number, viewer:IViewer<A>, fromView:IView<A>, toView:IView<A>):Promise<void> 
    {
        if (tween === undefined && this._promise === undefined)
        {
            this._transitioning = false;
            
            await viewer.setCurrent(toView);
            
            return;
        }

        if (tween === undefined) tween = new None(this._app, this);

        const fromTime = Date.now();
        const toTime = duration;
        
        await toView.load();
        viewer.__current = toView;
        tween.before(viewer, fromView, toView);

        if (this._promise !== undefined) 
        {
            try
            {
                if (typeof this._promise === 'function') this._promise = this._promise();
            }
            catch (error)
            {
                this._app.consoleUtil.error(this.constructor, error);
            }
        }

        let currentTime;
        do 
        {
            currentTime = Math.min(toTime, Date.now() - fromTime);

            await this._app.promiseUtil.nextAnimationFrame();

            if (toView.dnited === true || fromView.dnited === true) 
            {
                this._transitioning = false;
                this._viewToTransitionToAfter = undefined;
                return;
            }

            tween.during(currentTime / toTime);
        }
        while (currentTime < toTime)

        if (this._promise !== undefined) 
        {
            try
            {
                await this._promise;
            }
            catch (error)
            {
                this._app.consoleUtil.error(this.constructor, error);
            }
        }
        this._promise = undefined;

        tween.after();
        
        if (fromView.element.hasAttribute('nounload') !== true) fromView.unload();
        this._transitioning = false;
    }
}
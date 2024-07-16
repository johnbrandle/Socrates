/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * - Views as Building Blocks: Views are fundamental elements forming the application's navigational
 *   hierarchy. They resemble Sprites in ActionScript, capable of containing other Views and being
 *   nested within them.
 * 
 * - Loading and Unloading Behavior: Views have an automatic mechanism to load and unload their
 *   direct child Views based on their own loading state. By default, Views are in an unloaded state
 *   upon creation, meaning they are not visible initially.
 * 
 * - Viewer - A Specialized View: 'Viewer' extends the basic View, akin to a MovieClip in ActionScript.
 *   The immediate children of a Viewer are comparable to frames in a MovieClip, while their sub-children
 *   are like the Sprites within those frames. A Viewer, even when nested inside another View, remains
 *   part of the application's navigation structure. Unlike Views, a Viewer typically shows only one child
 *   View at a time and requires at least one child View to function correctly.
 * 
 * - Root and Base Views: The root View is the top-level View in the application, similar to the 'stage'
 *   in ActionScript. Base Views are specialized Views designed to be treated as a single, indivisible unit
 *   by their parent Views. When navigating through Views, the navigation system treats a Base View as a
 *   singular entity, disregarding its internal structure, which may include nested Viewers and their
 *   respective Views. A View can be marked as a BaseView by either setting the 'data-base' attribute on the
 *   View's element or by ensuring the parent node is not a View.
 * 
 * - Transient Views: These are a type of View that not only hide but also release resources and remove
 *   their children from the DOM when unloaded. When reloaded, they reconstruct their children and resources,
 *   ensuring they are in a fresh state. Transient Views are governed by the ITransientable interface and are
 *   especially useful in large navigation trees for resource management. Their behavior necessitates a
 *   sequential loading process in route-based navigation systems, as detailed in 'Router.ts'.
 * 
 *   Note: Transient Views cannot be Viewers (at least for now), as Viewers are supposed to always have at least one child View.
 * 
 * - Initialization and Deinitialization: Transient Views undergo a partial deinitialization process upon
 *   unloading and a complete initialization process when loaded, ensuring they are reset to a default state.
 */

import { Component } from '../Component.ts';
import { __ViewAttributes } from './__internal/__attributes.ts';
import { TransitionState } from './transition/Transition.ts';
import type { IView } from './IView.ts';
import { IViewerType, type IViewer } from './IViewer.ts';
import type { IBaseApp } from '../../IBaseApp.ts';
import { ComponentDecorator } from '../../decorators/ComponentDecorator.ts';
import { IViewType, OnLoadState } from './IView.ts';
import { ResolvePromise } from '../../../../../../../shared/src/library/promise/ResolvePromise.ts';
import type { IComponent } from '../IComponent.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import type { uid } from '../../utils/UIDUtil.ts';
import { ImplementsDecorator } from '../../../../../../../shared/src/library/decorators/ImplementsDecorator.ts';

export enum LoadState
{
    Unloaded = 0,
    Loaded = 1,
}

export enum ShowState
{
    Hidden = 0,
    Shown = 1,
}

@ComponentDecorator()
@ImplementsDecorator(IViewType)
export class View<A extends IBaseApp<A>> extends Component<A> implements IView<A> 
{    
    /**
     * The load state of the view.
     * 
     * Unloaded by default.
     */
    protected _loadState:LoadState = LoadState.Unloaded;
    public get loaded():boolean { return this._loadState === LoadState.Loaded; }

    /**
     * The show state of the view.
     * 
     * Hidden by default.
     */
    protected _showState:ShowState = ShowState.Hidden;

    /**
     * The promise that resolves when the view is loaded.
     * 
     * Undefined if not loading.
     */
    protected _loadPromise?:Promise<void>;

    /**
     * The promise that resolves when the view is unloaded.
     * 
     * Undefined if not unloading.
     */
    protected _unloadPromise?:Promise<void>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, html?:string, uid?:uid) 
    {
        super(app, destructor, element, html, uid);

        //should be display none and hidden by default. we use both because we want to be able to load the element with it's proper display value, but we don't want it to be visible until it is loaded
        element.style.display = 'none';
        element.style.visibility = 'hidden';

        //should take up all available space by default
        element.style.flexGrow = '1';
        element.style.width = '100%';
        element.style.height = '100%';
    }

    public override async init(...args:[]):Promise<void>
    { 
        await super.init();

        const element = this._element;

        //if this is a base view, it is good to set the data-base attribute so it is clear that this is a base view when inspecting the dom
        if (this.parent === undefined) element.setAttribute(__ViewAttributes.Base, ''); 
    }

    public override async ready():Promise<void>
    {
        //if there is no parent, and there is no noload attribute, and we are not loading, then automatically load
        //base views will still be loaded by their parent view if they have one, so no need to do that here
        if (this.parent === undefined && this.element.hasAttribute(__ViewAttributes.NoLoad) === false && this._loadPromise === undefined) await this.load();

        return super.ready();
    }

    public async dnit(partial:boolean=false):Promise<boolean>
    {
        if (await super.dnit(partial) !== true) return false;

        //transients call dnit on themselves when they unload (@see ComponentFactory.ts),
        //so we need to make sure we are not unloading a transient, otherwise we will hang (as it is already in the process of unloading)
        if (partial === false) 
        {
            let promise:Promise<void> | undefined;
            let count = 0;
            do
            {
                count++;

                promise = this._loadPromise ?? this._unloadPromise;
                if (promise === undefined) break;
                
                await promise;

                if (count > 100) this._app.throw('too many attempts', []);
            }
            while (true);

            if (this._loadState === LoadState.Loaded) await this.unload(); //unload if the view is loaded 
        }

        return true;
    }

    public async load(show:boolean=true):Promise<void> 
    {
        const element = this._element;

        //if the view is already loaded, just ensure the show state is correct
        if (this._loadState === LoadState.Loaded) 
        {
            if (show === true && this._showState === ShowState.Hidden) 
            {
                element.style.visibility = 'visible';
                this._showState = ShowState.Shown;
            }
            else if (show === false && this._showState === ShowState.Shown) 
            {
                element.style.visibility = 'hidden';
                this._showState = ShowState.Hidden;
            }
            
            return;
        }

        //if the view is already loading, return the load promise + load again with the specified show state
        if (this._loadPromise !== undefined) return this._loadPromise.then(() => this.load(show));

        //if the view is already unloading, return the unload promise + load again with the specified show state
        if (this._unloadPromise !== undefined) return this._unloadPromise.then(() => this.load(show));

        const promise = new ResolvePromise<void>();
        this._loadPromise = promise;
 
        //no catch block. let them handle the error higher up
        try
        {      
            //transient views create their children in doLoad, so call that first
            await this.doLoad();

            //this will ensure the view has a width and height. call this after doLoad 
            element.style.display = 'flex';

            //load the child views
            const promises = [];
            for (const view of this.views)
            {
                //if the view has the noload attribute, don't load it
                if (view.element.hasAttribute(__ViewAttributes.NoLoad) === true) continue;

                promises.push(view.load());
            }

            //wait for all the child views to load
            await Promise.all(promises);
        }
        finally
        {
            if (element.style.display !== 'flex') element.style.display = 'flex'; //just in case there was an error in doLoad, we want to make sure the display is set to flex

            //if we are showing the view, make it visible
            if (show === true) element.style.visibility = 'visible';

            //update the load and show states
            this._loadState = LoadState.Loaded;
            this._showState = show === true ? ShowState.Shown : ShowState.Hidden;

            //dispatch the change event
            this.onChangeSignal.dispatch(this, OnLoadState, {from:LoadState.Unloaded, to:LoadState.Loaded});

            //set the load promise to undefined as we are no longer loading
            this._loadPromise = undefined;

            //resolve the promise
            promise.resolve();
        }
    }

    /**
     * Override this method to load the view's resources, which is called everytime the view is loaded.
     */
    protected async doLoad():Promise<void> {}

    public async unload():Promise<void>
    {
        //if the view is already unloaded, return
        if (this._loadState === LoadState.Unloaded) return;

        //if the view is already unloading, return the unload promise
        if (this._unloadPromise !== undefined) return this._unloadPromise;

        //if the view is already loading, return the load promise + unload again
        if (this._loadPromise !== undefined) return this._loadPromise.then(() => this.unload());
         
        const promise = new ResolvePromise<void>();
        this._unloadPromise = promise;

        //set the visibility to hidden, so the view will not be visible while unloading, but will still have a width and height
        this._element.style.visibility = 'hidden';

        //no catch block. let them handle the error higher up
        try
        {
            //unload the child views
            const promises = [];
            for (const view of this.views)
            {
                //if the view has the noload attribute, don't unload it
                if (view.element.hasAttribute(__ViewAttributes.NoLoad) === true) continue;

                promises.push(view.unload());
            }

            //wait for all the child views to unload
            await Promise.all(promises);

            //transient views destroy their children in doUnload, so call that last
            await this.doUnload();
        }
        finally
        {
            //now that the view is unloaded, set the display style to none
            this._element.style.display = 'none';

            //update the load and show states
            this._loadState = LoadState.Unloaded; 
            this._showState = ShowState.Hidden;

            //dispatch the change event
            this.onChangeSignal.dispatch(this, OnLoadState, {from:LoadState.Loaded, to:LoadState.Unloaded});

            //set the unload promise to undefined as we are no longer unloading
            this._unloadPromise = undefined;

            //resolve the promise
            promise.resolve();
        }
    }

    /**
     * Override this method to unload the view's resources, which is called everytime the view is unloaded.
     */
    protected async doUnload():Promise<void> {}

    public goto(view:IView<A>):Promise<void> 
    {
        const viewer = this.viewer;

        //must have a viewer anscestor to use goto
        if (viewer === undefined) this._app.throw('cannot goto if no parent viewer', [], {correctable:true});

        return viewer.goto(view); 
    }

    /**
     * Gets the first view in the navigational heirarchy.
     * @returns The first view or undefined if there is no view.
     */
    public get first():IView<A> | undefined 
    { 
        const app = this._app;
        const stack: (IView<A> | undefined)[] = [];
        let stackIndex = -1; //using this to manually manage the "top" of the stack
    
        stack[++stackIndex] = this.base; //initial push
    
        while (stackIndex >= 0) 
        {
            const currentView = stack[stackIndex]; //peek at the top of the stack
    
            if (currentView === undefined) 
            {
                stackIndex--; //equivalent to a pop operation without actually removing the element for performance
                continue;
            }
    
            if (app.typeUtil.is<IViewer<A>>(currentView, IViewerType) === true) 
            {
                const first = currentView.first;
                if (app.typeUtil.is<IViewer<A>>(first, IViewerType) === true) 
                {
                    stack[stackIndex] = first; //overwrite the current top with the new view
                    continue;
                }
                
                return first;
            }
    
            const views = currentView.views;
            let found = false;
    
            for (let i = 0, length = views.length; i < length; i++) 
            {
                const eachView = views[i];
    
                if (eachView.base === eachView) continue;
    
                stack[++stackIndex] = eachView; //push to the stack
                found = true;
                break;
            }
    
            if (!found) stackIndex--; 
        }
    
        return undefined; //default return value in case no view is found 
    }
    
    public get last():IView<A> | undefined 
    { 
        const app = this._app;
        const stack:(IView<A> | undefined)[] = [];
        let stackIndex = -1; //using this to manually manage the "top" of the stack
    
        stack[++stackIndex] = this.base; //initial push
    
        while (stackIndex >= 0) 
        {
            const currentView = stack[stackIndex]; //peek at the top of the stack
    
            if (currentView === undefined) 
            {
                stackIndex--; 
                continue;
            }
    
            if (app.typeUtil.is<IViewer<A>>(currentView, IViewerType) === true) 
            {
                const last = currentView.last;
                if (app.typeUtil.is<IViewer<A>>(last, IViewerType) === true) 
                {
                    stack[stackIndex] = last; //overwrite the current top with the new view
                    continue;
                }
                
                return last;
            }
    
            const views = currentView.views;
            let found = false;
            for (let i = 0, length = views.length; i < length; i++) 
            {
                const eachView = views[i];
    
                if (eachView.base === eachView) continue;
    
                stack[++stackIndex] = eachView; //push to the stack
                found = true;
                break;
            }
    
            if (!found) stackIndex--; 
        }
    
        return undefined; //default return value in case no view is found
    }
    
    public get next():IView<A> | undefined 
    { 
        const app = this._app;
        const stack:(IView<A> | undefined)[] = [];
        let stackIndex = -1; //manually manage the "top" of the stack
    
        stack[++stackIndex] = this.current; //initial push
    
        while (stackIndex >= 0) 
        {
            const currentView = stack[stackIndex]; //peek at the top of the stack
    
            if (currentView === undefined) 
            {
                stackIndex--; //pop without actually removing the element for performance
                continue;
            }
    
            if (currentView.viewer === undefined && app.typeUtil.is<IViewer<A>>(currentView, IViewerType) === true) 
            {
                let next = currentView.next;
                while (app.typeUtil.is<IViewer<A>>(next, IViewerType)) next = next.first;
                return next;
            }
    
            const viewer = currentView.viewer;
            if (viewer === undefined) return currentView;
    
            if (viewer.last === currentView) 
            {
                stack[stackIndex] = viewer; //replace the top of the stack with the new view
                continue;
            }
    
            let nextView = viewer.next;
            while (app.typeUtil.is<IViewer<A>>(nextView, IViewerType) === true) nextView = nextView.first;
    
            return nextView;
        }
    
        return undefined; //default return value in case no view is found
    }
    
    public get previous():IView<A> | undefined
    { 
        const app = this._app;
        const stack:(IView<A> | undefined)[] = [];
        let stackIndex = -1; //manually manage the "top" of the stack
    
        stack[++stackIndex] = this.current; //initial push
    
        while (stackIndex >= 0) 
        {
            const currentView = stack[stackIndex]; //peek at the top of the stack
    
            if (currentView === undefined) 
            {
                stackIndex--; //pop without actually removing the element for performance
                continue;
            }
    
            if (currentView.viewer === undefined && app.typeUtil.is<IViewer<A>>(currentView, IViewerType) === true) 
            {
                let previous = currentView.previous;
                while (app.typeUtil.is<IViewer<A>>(previous, IViewerType) === true) previous = previous.last;
                return previous;
            }
    
            const viewer = currentView.viewer;
            if (viewer === undefined) return currentView;
    
            if (viewer.first === currentView) 
            {
                stack[stackIndex] = viewer; //replace the top of the stack with the new view
                continue;
            }
    
            let previousView = viewer.previous;
            while (app.typeUtil.is<IViewer<A>>(previousView, IViewerType) === true) previousView = previousView.last;
    
            return previousView;
        }
    
        return undefined; //default return value in case no view is found
    }

    public get current():IView<A> 
    { 
        const app = this._app;
        const stack:IView<A>[] = [];
        let stackIndex = 0; //using this to manually manage the "top" of the stack
    
        stack[0] = this.base; //initial push
    
        let current:IView<A> = this;
        while (stackIndex < stack.length) 
        {
            const whileView = stack[stackIndex]; //peek at the top of the stack
    
            if (app.typeUtil.is<IViewer<A>>(whileView, IViewerType) === true) 
            {
                current = whileView.current;
                if (app.typeUtil.is<IView<A>>(current, IViewType) === true) 
                {
                    stack[stackIndex] = current; //overwrite the current top with the new view
                    continue;
                }

                return current;
            }
    
            for (const eachView of whileView.views)
            { 
                if (eachView.base === eachView) continue;
    
                stack.push(eachView); //push to the stack
                break;
            }
    
            stackIndex++;
        }

        return current;
    }

    public get views():Array<IView<A>> 
    { 
        const app = this._app;
        const views:Array<IView<A>> = [];
        const children = this._element.children;
        for (let i = 0, length = children.length; i < length; i++) 
        {
            const innerView = children[i].component;
            
            if (app.typeUtil.is<IView<A>>(innerView, IViewType) !== true) continue;

            views.push(innerView);
        }

        return views;
    }

    public get parent():IView<A> | undefined 
    { 
        const parentView = this._element.parentElement?.component as IView<A> | undefined;   
        
        return this._app.typeUtil.is<IView<A>>(parentView, IViewType) === true ? parentView : undefined;
    }
    
    public get viewer():IViewer<A> | undefined 
    { 
        const app = this._app;

        let parentView = this.parent;
        while (parentView !== undefined) 
        {
            if (app.typeUtil.is<IViewer<A>>(parentView, IViewerType) === true) return parentView;
            
            parentView = parentView.parent;
        }

        return undefined;
    }

    public get base():IView<A> 
    { 
        let parentView = this.parent;
        while (parentView !== undefined) 
        {
            if (parentView.element.hasAttribute(__ViewAttributes.Base) || parentView.parent === undefined) return parentView; //is a base view if it has the data-base attribute or if it has no parent
            
            parentView = parentView.parent;
        }

        return this;
    }

    public get root():IView<A> 
    {
        const app = this._app;

        let baseView = this.base;
        let parentElement = baseView.element.parentElement;

        while (parentElement && parentElement !== document.documentElement)
        {
            const innerView = (parentElement as HTMLElement).component;

            if (app.typeUtil.is<IView<A>>(innerView, IViewType) === true) 
            {
                baseView = innerView.base;
                parentElement = baseView.element.parentElement;
                continue;
            }

            parentElement = parentElement.parentElement;
        }

        return baseView;  
    }

    public get index():number 
    { 
        const parentView = this.parent;
        
        return parentView === undefined ? -1 : parentView.views.indexOf(this);
    }

    public get route():string { return this._element.getAttribute(__ViewAttributes.Route) ?? ''; } //path used for url routing

    public override get transparent():boolean { return true; } //children of views are not meant to be private
    
    protected onTransition(_state:TransitionState):void {} //override to handle transition state changes

    public __onTransition(state:TransitionState):void
    {
        const app = this._app;

        app.componentUtil.propagate(this._element, (component:IComponent<A>) => 
        {
            if (app.typeUtil.is<View<A>>(component, IViewType) !== true) return false;
            
            component.__onTransition(state);

            return true; //stop propagation
        }, false, false, true);

        this.onTransition(state);
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 *
 * @see View.ts for more information
 */

import { __ViewAttributes } from './__internal/__attributes.ts';
import { View, LoadState, ShowState } from './View.ts';
import type { IView } from './IView.ts';
import type { IViewer } from './IViewer.ts';
import type { IBaseApp } from '../../IBaseApp.ts';
import { ComponentDecorator } from '../../decorators/ComponentDecorator.ts';
import { IViewerType, OnCurrent } from './IViewer.ts';
import { ResolvePromise } from '../../../../../../../shared/src/library/promise/ResolvePromise.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { ITransitionType, type ITransition } from './transition/ITransition.ts';
import { Transition, TransitionState } from './transition/Transition.ts';
import { ImplementsDecorator } from '../../../../../../../shared/src/library/decorators/ImplementsDecorator.ts';

@ComponentDecorator()
@ImplementsDecorator(IViewerType)
export class Viewer<A extends IBaseApp<A>> extends View<A> implements IViewer<A> 
{
    private _transition:ITransition<A> | undefined;
    public get transition():ITransition<A> | undefined { return this._transition; }

    private _current:IView<A> | undefined;
    public override get current():IView<A> { return this._current!; }

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element);
    }

    public override async init(...args:any[]):Promise<void>
    {
        await super.init();

        const isRouter = this.isRouter;
        const element = this._element;
        const views = this.views;

        if (views.length === 0) this._app.throw('one or more views required', [], {correctable:true});

        //register the viewer with the router if it is a router
        if (isRouter === true) this._app.router.register(this);

        //create a transition if one is specified
        const transition = element.getAttribute(__ViewAttributes.Transition) ?? '';
        if (transition.length > 0) this._transition = this._app.instanceManager.parse<ITransition<A>>(this, transition, {type:ITransitionType, defaultArgs:[this]});
 
        //get the index of the child view to default as current
        let index = parseInt(element.getAttribute(__ViewAttributes.Index) ?? '0') || 0; //child view to default as current               
        
        //check if the view is a router. if so, possibly override the default index based on the url path
        if (isRouter === true)
        {
            //get the index from the router
            const value = this._app.router.getIndex(this);
            if (value !== -1) index = value;
        }

        //ensure the index is within the bounds of the views array
        if (index >= views.length || index < 0) this._app.throw('view index out of range', [], {correctable:true});

        //set the current view
        this.__current = views[index];
    }

    public async dnit():Promise<boolean>
    {
        if (await super.dnit(false) !== true) return false;

        //set the current view to undefined
        this._current = undefined;

        //unregister the viewer with the router if it is a router
        if (this.isRouter === true) this._app.router.unregister(this);

        //return true to indicate a successful dnit
        return true;
    }

    /**
     * Sets the current view without doing any loading/unloading.
     * 
     * Transitions use this.
     * 
     * Note: methods beginning with two underscores are considered internal, and should only be called by the framework.
     */
    public set __current(view:IView<A>)
    {
        //view must not be undefined
        if (view === undefined) this._app.throw('cannot set current to undefined value.', [], {correctable:true});
        
        //view must have the same load state as the viewer
        if (this.loaded !== view.loaded) this._app.throw('cannot set current to a view with a different load state.', [], {correctable:true});

        //view must be a child of this viewer
        if (view.parent !== this) this._app.throw('cannot set current to a view that is not a child of this viewer.', [], {correctable:true});

        //viewer must not be currently loading or unloading
        if (this._loadPromise !== undefined) this._app.throw('cannot set current while loading.', [], {correctable:true});
        if (this._unloadPromise !== undefined) this._app.throw('cannot set current while unloading.', [], {correctable:true});

        const current = this._current;

        //view must not be the same as the current view
        if (view === current) this._app.throw('cannot set current to the same value.', [], {correctable:true}); //maybe don't throw on this condition. keep unless there is a good reason to remove it

        //set the current view
        this._current = view;

        //dispatch the change event
        this.onChangeSignal.dispatch(this, OnCurrent, {from:current?.index ?? -1, to:view.index});
    }

    /**
     * Sets the current view of the Viewer.
     * 
     * @param view - The view to set as the current view.
     * @returns A promise that resolves once the current view has been set.
     * @throws {Error} If the view is the same as the current view, is undefined, or is not a child of this viewer.
     * @throws {Error} If the current view fails to finish loading or unloading within 100 attempts.
     */
    public async setCurrent(view:IView<A>):Promise<void>
    {
        const current = this._current;

        //view must not be the same as the current view, but don't throw on this condition, unless there is a good reason to do so (set __current throws on this condition, due to its internal nature)
        if (view === current) return;
        
        //view must not be undefined
        if (view === undefined) this._app.throw('cannot set current to undefined value.', [], {correctable:true});
        
        //view must be a child of this viewer
        if (view.parent !== this) this._app.throw('cannot set current to a view that is not a child of this viewer.', [], {correctable:true});
        
        //wait for the current view to finish loading or unloading, and add a safety check to prevent infinite loops
        let count = 0;
        while (true)
        {
            const promise = this._loadPromise ?? this._unloadPromise;
            if (promise === undefined) break;

            await promise;

            count++;

            if (count > 100) this._app.throw('cannot set current while loading.', [], {correctable:true});
        }

        //unload the current view
        if (current !== undefined) await current.unload();

        //set the current view
        this._current = view;

        //dispatch the change event
        this.onChangeSignal.dispatch(this, OnCurrent, {from:current?.index ?? -1, to:view.index});

        //load the current view if the viewer is loaded
        if (this.loaded === true) await view.load();
    }

    /**
     * Navigates to the specified view.
     * 
     * @param view - The view to navigate to. It can be either an instance of IView or the index of the view in the views array.
     * @returns A promise that resolves when the navigation is complete.
     */
    public override async goto(view:IView<A> | number):Promise<void> 
    {
        //if the view is a number, get the view at the index
        if (this._app.typeUtil.isNumber(view) === true) view = this.views[view];

        //view must not be undefined
        if (view === undefined) this._app.throw('cannot goto undefined view.', [], {correctable:true});
        
        //viewer must be loaded
        if (this.loaded === false) this._app.throw('cannot goto view while viewer is not loaded.', [], {correctable:true});

        //find the first viewer with a transition, as this is the transition we will use
        let viewer:IViewer<A> | undefined = this;
        while (viewer !== undefined)
        {
            if (viewer.transition !== undefined) break;
            if (viewer.base === viewer) break;
            
            viewer = viewer.viewer;
        }

        //we may have found a viewer with a transition
        if (viewer !== undefined)
        {
            const transition = viewer.transition;

            //if the viewer has a transition, use it to goto the view
            if (transition !== undefined) return transition.goto(view); 
        }
        
        //if we get here, we didn't find a viewer with a transition, so we will create a new default transition
        const transition = new Transition(this._app, this, this);

        //no catch block. let them handle the error higher up
        try
        {
            await transition.goto(view);
        }
        finally
        {
            //be sure to dnit the transition, as it is no longer needed
            transition.dnit();
        }
    }

    /**
     * Retrieves the view at the specified index.
     * 
     * @param index - The index of the view to retrieve.
     * @returns The view at the specified index.
     */
    public at(index:number):IView<A>
    {
        return this.views[index];
    }

    /**
     * Loads the viewer with the specified show state.
     * 
     * @param show - A boolean indicating whether to show or hide the viewer after loading.
     * @returns A promise that resolves when the viewer is loaded.
     */
    public override async load(show:boolean=true):Promise<void> 
    {
        const element = this._element;

        //if the viewer is already loaded, just ensure the show state is correct
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

        //if the viewer is currently loading, return the load promise + load again with the specified show state
        if (this._loadPromise !== undefined) return this._loadPromise.then(() => this.load(show));

        //if the viewer is currently unloading, return the unload promise + load again with the specified show state
        if (this._unloadPromise !== undefined) return this._unloadPromise.then(() => this.load(show));

        const promise = new ResolvePromise<void>();
        this._loadPromise = promise;
        
        //set the display style to flex, so the viewer will have a width and height while loading
        element.style.display = 'flex';

        //no catch block. let them handle the error higher up
        try
        {
            await this.current.load();
        }
        finally
        {
            //if show is true: now that it is loaded, set the visibility to visible
            if (show === true) element.style.visibility = 'visible';

            //update the load and show states
            this._loadState = LoadState.Loaded;
            this._showState = show === true ? ShowState.Shown : ShowState.Hidden;

            //set the load promise to undefined, as it is no longer loading
            this._loadPromise = undefined;

            //resolve the promise
            promise.resolve();
        }
    }

    public override async unload():Promise<void> 
    {
        //if the viewer is already unloaded, return
        if (this._loadState === LoadState.Unloaded) return;

        //if the viewer is currently unloading, return the unload promise
        if (this._unloadPromise !== undefined) return this._unloadPromise;

        //if the viewer is currently loading, return the load promise + unload again
        if (this._loadPromise !== undefined) return this._loadPromise.then(() => this.unload());

        const promise = new ResolvePromise<void>();
        this._unloadPromise = promise;

        //set the visibility to hidden, so the viewer will not be visible while unloading, but will still have a width and height
        this._element.style.visibility = 'hidden';

        //no catch block. let them handle the error higher up
        try
        {
            await this.current.unload();
        }
        finally
        {
            //now that the viewer is unloaded, set the display style to none
            this._element.style.display = 'none';

            //update the load and show states
            this._loadState = LoadState.Unloaded; 
            this._showState = ShowState.Hidden;

            //set the unload promise to undefined, as it is no longer unloading
            this._unloadPromise = undefined;

            //resolve the promise
            promise.resolve();
        }
    }

    /**
     * Checks if the viewer contains a specific view.
     * @param view - The view to check for.
     * @returns True if the viewer contains the view, false otherwise.
     */
    public contains(view:IView<A>):boolean 
    {
        return this.views.indexOf(view) !== -1;
    }

    /**
     * Gets the next view in the sequence.
     * If the current view is the last view, it returns the first view.
     * @returns The next view.
     */
    public override get next():IView<A> 
    {
        const views = this.views;
        const index = this._current!.index;
        
        if (index >= views.length - 1) return views[0];
        
        return views[index + 1];
    }

    /**
     * Gets the previous view in the sequence.
     * If the current view is the first view, it returns the last view.
     * @returns The previous view.
     */
    public override get previous():IView<A> 
    {
        const views = this.views;
        const index = this._current!.index;
        
        if (index <= 0) return views[views.length - 1];
        
        return views[index - 1];
    }

    /**
     * Gets the first view in the sequence.
     * @returns The first view.
     */
    public override get first():IView<A>
    {
        return this.views[0];
    }

    /**
     * Gets the last view in the sequence.
     * @returns The last view.
     */
    public override get last():IView<A> 
    {
        const views = this.views;

        return views[views.length - 1];
    }

    /**
     * Gets a value indicating whether the viewer is a router. @see Router.ts
     * @returns {boolean} True if the viewer is a router, false otherwise.
     */
    public get isRouter():boolean { return this._element.hasAttribute(__ViewAttributes.Router); }

    public override __onTransition(state:TransitionState):void
    {
        if (this._current !== undefined) this._current.__onTransition(state);

        this.onTransition(state);
    }
}
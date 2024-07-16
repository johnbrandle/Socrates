/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IView } from "../components/view/IView.ts";
import type { IViewer } from "../components/view/IViewer.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import type { IRouter } from "./IRouter.ts";
import { IRouterType } from "./IRouter.ts";
import { DebounceAssistant } from "../assistants/DebounceAssistant.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator.ts";
import type { IAbortable } from "../../../../../../shared/src/library/abort/IAbortable.ts";
import type { IAborted } from "../../../../../../shared/src/library/abort/IAborted.ts";
import type { IError } from "../../../../../../shared/src/library/error/IError.ts";

/**
 * Class for managing application routing.
 * @implements {IRouter}
 */
@ImplementsDecorator(IRouterType)
export abstract class Router<A extends IBaseApp<A>> extends DestructableEntity<A> implements IRouter<A>
{
    /**
     * Map to store route details.
     * @type {Map<string, [IViewer, IView, number]>}
     */
    private _routes:Map<string, [IViewer<A>, IView<A>, number]> = new Map();

    /**
     * Creates an instance of Router.
     * @param {A} app - The application instance.
     */
    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    /**
     * Registers a viewer and its associated views.
     * @param {IViewer} viewer - The viewer to register.
     */
    public register(viewer:IViewer<A>):void
    {
        const views = viewer.views;
        for (let i = views.length; i--;)
        {
            const view = views[i];

            const route = view.route;

            if (!route) continue;

            this._routes.set(route, [viewer, view, i]);
        }

        if (viewer.route) this._routes.set(viewer.route, [viewer, views[0], 0]);
    }

    /**
     * Unregisters a viewer and its associated views.
     * @param {IViewer} viewer - The viewer to unregister.
     */
    public unregister(viewer:IViewer<A>):void
    {
        let routes = this._routes;
        routes.forEach((value, key) => 
        {            
            let [innerViewer] = value;

            if (viewer !== innerViewer) return;

            routes.delete(key);
        });
    }

    /**
     * Gets the index of a viewer's route that matches the current URL pathname.
     * @param {IViewer} viewer - The viewer for which to get the index.
     * @return {number} The index of the viewer's route.
     */
    public getIndex(viewer:IViewer<A>):number
    {
        let route = this.processRoute(document.location.pathname);
        
        let [innerViewer, view, index] = this._routes.get(route) ?? [];
        if (innerViewer === viewer) return index!;

        return -1;
    }

    /**
     * Method to navigate to a specific route. This method loads and shows the viewer associated 
     * with the given route, starting from the root view and working its way down into the tree.
     * This is done to account for viewers in transient views. If the route doesn't exist, a warning 
     * will be logged, and the method will return false. If successful, the method updates the URL 
     * path and returns true.
     *
     * @param {string} route - The route to navigate to. The route should be a string starting with "/".
     * @param {boolean} createHistoryEntry - If true, a history entry will be created. This is useful for enabling browser back button navigation.
     * @returns {Promise<boolean>} - Returns a promise that resolves to true if the navigation was successful, and false otherwise.
     * 
     * Example: Imagine you're trying to navigate to the route "/admin/dashboard/settings".
     *
     * Firstly, the goto function splits this route into parts: ['admin', 'dashboard', 'settings']. This parts array represents the path hierarchy.
     * Then the while loop starts. It will work through the parts of the route from left to right, building up the currentRoute as it goes and trying to navigate to each level of the route.
     * On the first iteration, part is 'admin'. This gets appended to currentRoute, making currentRoute equal to '/admin'. It then retrieves the viewer and view associated with '/admin' from the _routes map. If a viewer and view exist, the viewer is shown and the current view is set.
     * On the second iteration, part is 'dashboard'. currentRoute now becomes '/admin/dashboard'. Again, it retrieves the viewer and view associated with this route, shows the viewer, and sets the current view.
     * On the third iteration, part is 'settings'. currentRoute is now '/admin/dashboard/settings'. The process repeats: it retrieves the viewer and view for the route, shows the viewer, and sets the current view.
     * If at any stage it can't find a viewer for the currentRoute, it logs a warning and returns false, indicating navigation to the route failed.
     * After the loop completes (having navigated to all parts of the route), it updates the URL path to reflect the new route, and returns true, indicating that navigation to the route was successful.
     * This process ensures that not just the final view is loaded and displayed, but each intermediate step along the path is also correctly handled, mimicking the hierarchical nature of URL paths.
     */
    public async goto(route:string, options?:{createHistoryEntry?:boolean, goto?:boolean}):Promise<boolean | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            route = this.processRoute(route); //process the route
            
            this.#updateUrlPath(route, options?.createHistoryEntry ?? true); //update the URL path immediately

            return _.value(await this._goto.execute(route, {goto:options?.goto ?? true}));
        }
        catch (error)
        {
            return this._app.warn(error, 'Error occurred while navigating to route.', [route, options], {names:[this.constructor, this.goto]});
        }
    }

    private _goto = new DebounceAssistant<A, [string, {goto:boolean}], boolean>(this, async(abortable:IAbortable, route:string, options:{goto:boolean}):Promise<boolean | IAborted | IError> =>
    {
        try
        {
            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            this.log(`navigating to`, route);

            const parts = route.split('/'); //split the route into its parts
            let currentRoute = '';
            let navigated = false;

            let firstViewer:IViewer<A> | undefined;
            let firstView:IView<A> | undefined;
            if (parts.length > 1) parts.shift(); //so, ["", "login"] becomes ["login"] and ["", ""] becomes [""]
            while (parts.length) //start from the root view, load, then work your way down into the tree (this is to account for viewers in transient views)
            {
                const part = parts.shift(); //get the next part of the route
                
                currentRoute += '/' + part; //add the current part to the currentRoute

                const [viewer, view] = this._routes.get(currentRoute) || []; //get the viewer and view for the currentRoute
                if (viewer === undefined || view === undefined) 
                {
                    navigated = false;
                    break;
                }

                //for the lowest level viewer/view, we just want to ensure they are loaded
                if (firstViewer === undefined)
                {
                    firstViewer = viewer;
                    firstView = view;

                    await viewer.load(); //necessary, as this is the lowest level viewer/view
                    await view.load(false); //set it to false, so it won't show by default
                }
                else
                {
                    //we want to set the current view, so that when we transition it will be showing
                    await viewer.setCurrent(view!);
                }

                navigated = true;
            }

            if (navigated !== true) 
            {
                this.warn('invalid navigation route, navigated to root route instead', route);

                this.#updateUrlPath(route, false); //update the URL path immediately

                await this._goto.execute('/', {goto:false}); //if we get here, the route was invalid, so go to the root route)
                return false;
            }

            if (firstViewer!.current === firstView) await firstView!.load(true); //it doesn't need to be transitioned to, so just show the view
            else if (options.goto === true) await firstViewer!.goto(firstView!);
            else await firstViewer!.setCurrent(firstView!);

            return true; //if we've made it this far, the navigation was successful, so return true
        }
        catch (error)
        {
            return this._app.warn(error, 'Error occurred while navigating to route.', [route, options], {names:[this.constructor, '_goto']});
        }
    }, {debug:false, id:'_goto'});

    public redirect(route:string, createHistoryEntry:boolean=false):void //like goto, but reloads the page, useful if we need an abrupt change in routing and don't want to worry about messing up the application state. note: createHistoryEntry might not make sense for a redirect. may choose to remove this later.
    {
        route = this.processRoute(route); //process the route

        if (this._app.debugUtil.isDebug === true) alert('redirecting to: ' + route);

        document.body.innerHTML = ''; //clear the body

        this.#updateUrlPath(route, createHistoryEntry);

        window.location.reload();
    }

    protected processRoute(route:string):string
    {
        if (route.endsWith('/') === true) route = route.slice(0, -1); //remove trailing "/" from the route if it exists
     
        return route || '/'; //if the route is empty, return "/" (the root route)
    }

    /**
     * Updates the URL based on the longest matching route.
     */
    protected updateURL():void
    {
        const routes = this._routes;

        let longestRoute = '';
        for (const [route, value] of routes)
        {            
            const [viewer, view] = value;

            if (viewer.current !== view) return;
            if (!viewer.loaded) return;

            if (route > longestRoute) longestRoute = route;
        };

        this.#updateUrlPath(longestRoute, false);
    }

    /**
     * Updates the URL pathname and manages the browser history entry.
     * @private
     * @param {string} path - The new URL pathname.
     * @param {boolean} createHistoryEntry - Whether to create a new history entry.
     */
    #updateUrlPath(route:string, createHistoryEntry:boolean):void 
    {
        const currentUrl = new URL(window.location.href);
        currentUrl.pathname = route;

        if (createHistoryEntry) history.pushState(null, '', currentUrl.toString());
        else history.replaceState(null, '', currentUrl.toString());
    }
}
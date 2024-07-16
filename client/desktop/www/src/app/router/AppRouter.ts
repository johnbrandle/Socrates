/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../IApp.ts";
import { Router } from "../../library/router/Router.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { GlobalEvent } from "../../library/managers/GlobalListenerManager.ts";

export class AppRouter<A extends IApp<A>> extends Router<A>
{
    public static ROUTE_EXPLORER = '/explorer';
    public static ROUTE_LOGIN = '/login';
    public static ROUTE_REGISTER = '/register';
    public static ROUTE_CREATE = '/create';
    public static ROUTE_EXPERIMENT = '/experiment';
    public static ROUTE_INDEX = '/';
    public static ROUTE_BROWSER_NOT_RECOMMENDED = '/browser_not_recommended';

    private static _routesThatDoNotRequireValidSession = 
    [
        AppRouter.ROUTE_LOGIN, 
        AppRouter.ROUTE_REGISTER, 
        AppRouter.ROUTE_BROWSER_NOT_RECOMMENDED, 
        AppRouter.ROUTE_EXPERIMENT
    ];

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        this._app.globalListenerManager.subscribe(this, GlobalEvent.Click_Capture, this.#onClick);
        this._app.globalListenerManager.subscribe(this, GlobalEvent.PopState, this.#onPopState);
    }

    #onClick = async (event:MouseEvent) =>
    {
        const target = (event.target ?? undefined) as HTMLElement | undefined;
        if (target === undefined) return;
            
        if (target.tagName === 'A' || target.closest('a')) 
        {
            const a:HTMLAnchorElement | undefined = target.tagName === 'A' ? target as HTMLAnchorElement : target.closest('a') ?? undefined;
            if (a === undefined) return;

            const url = new URL(a.href);
            if (url.hostname != document.location.hostname || (a.target ?? '').toLocaleLowerCase() === '_blank') return; //ignore links to outside urls

            event.preventDefault();

            const hrefAttributeValue = a.getAttribute('href');
            if (!hrefAttributeValue || hrefAttributeValue === '#') return; //ignore links to the root (# hrefs)

            await this.goto(url.pathname, {createHistoryEntry:true, goto:true});
        }
    }

    #onPopState = async (_event:PopStateEvent) => //make sure if they hit the back or forward button we let the router know
    {
        const url = new URL(document.location.toString()); 
        await this.goto(url.pathname, {createHistoryEntry:false, goto:true});
    }

    protected override processRoute(route:string):string
    {
        route = super.processRoute(route);

        const loggedIn = this._app.userManager.model.loggedIn;

        if (loggedIn === true) return route;

        //check if route string is in the list of routes that do not require a valid session
        for (const value of AppRouter._routesThatDoNotRequireValidSession) if (route.startsWith(value) === true) return route;

        //if we get here, the route requires a valid session
        return AppRouter.ROUTE_LOGIN;
    }
}
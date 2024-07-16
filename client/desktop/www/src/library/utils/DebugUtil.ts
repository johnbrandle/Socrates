/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 */

import type { IComponent } from "../components/IComponent";
import { DebugUtil as Shared } from "../../../../../../shared/src/library/utils/DebugUtil";
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from "../IBaseApp";

/**
 * Utility class for debugging purposes.
 * Provides functionalities like tracking removed DOM nodes associated with components (so we can verify that they were properly dnited),
 * displaying debug-specific context menus, and more.
 *
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class DebugUtil<A extends IBaseApp<A>> extends Shared<A>
{
    public constructor(app:A)
    {
        super(app);

        //initialize debugging utilities if debug mode is enabled.
        if (self.environment.frozen.isDebug !== true) return;
        
        app.consoleUtil.log(DebugUtil, 'debug:', true);
        app.consoleUtil.log(DebugUtil, 'dev tools opened:', self.environment.isDevToolsOpen === undefined ? 'unknown' : self.environment.isDevToolsOpen);
        app.consoleUtil.log(DebugUtil, 'plain text mode:', self.environment.frozen.isPlainTextMode);

        //add a debug class to the body for styling or other debug-specific behaviors.
        document.body.classList.add('debug');

        //attach a context menu listener to handle debug-specific actions on right-click with shift key.
        document.addEventListener('contextmenu', this.onContextMenu, {passive:false, capture:true});

        //initialize and start observing DOM mutations.
        this._observer = new MutationObserver(this.handleMutations);
        this._observer.observe(document.body, {childList:true, subtree:true});

        //start the interval to check removed components.
        this.beginComponentCheckInterval();
    }

    //an observer to track DOM mutations.
    private _observer:MutationObserver | undefined;

    //a map to track removed components and their timestamp of removal.
    private _removedComponentsMap = new Map<IComponent<any>, number>();

    /**
     * Event handler for the context menu event.
     * Pauses the debugger if a component is associated with the clicked element.
     * 
     * @param event The MouseEvent triggered by right-click.
     */
    private onContextMenu = (event:MouseEvent) =>
    {
        //only process the event if the shift key is pressed.
        if (event.shiftKey !== true) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        //traverse up the DOM tree to find an element associated with a component.
        let target:HTMLElement | undefined = (event.target ?? undefined) as HTMLElement | undefined;
        let component:IComponent<any> | undefined = undefined;
        while (target !== undefined)
        {
            component = target.component;
            if (component !== undefined) break;

            target = target.parentElement ?? undefined;
        }

        //pause the debugger if a component was found.
        if (component) 
        {
            debugger;
        }
    }

    /**
     * Handles DOM mutations.
     * Tracks removed nodes associated with components, so that they can be checked later.
     * 
     * @param mutations The list of MutationRecords.
     */
    private handleMutations = (mutations:MutationRecord[]) =>
    {
        //helper function to add a removed node and its descendants to the map.
        const addRemovedNodeAndDescendants = (element:Element, timestamp:number) =>
        {
            if (element.component !== undefined) this._removedComponentsMap.set(element.component, timestamp);
            
            //recursive call for child elements.
            for (let i = element.children.length; i--;) addRemovedNodeAndDescendants(element.children[i], timestamp);
        }

        //helper function to remove a node and its descendants from the map.
        const removeNodeAndDescendantsFromMap = (element:Element) => 
        {
            if (element.component !== undefined) this._removedComponentsMap.delete(element.component);
    
            //recursive call for child elements.
            for (let i = element.children.length; i--;) removeNodeAndDescendantsFromMap(element.children[i]);
        }

        const now = Date.now();

        //handle removed nodes.
        for (const mutation of mutations) 
        {
            for (const node of mutation.removedNodes as any) 
            {
                if (node instanceof Element) addRemovedNodeAndDescendants(node, now);
            }
        }

        //handle added nodes.
        for (const mutation of mutations) 
        {
            for (const node of mutation.addedNodes as any) 
            {
                if (node instanceof Element) removeNodeAndDescendantsFromMap(node);
            }
        }
    }

    /**
     * Starts an interval to check components in the `_removedComponentsMap`.
     * If a component has been in the map for more than a second and hasn't been dnited (destroyed), 
     * an error is logged.
     */
    private beginComponentCheckInterval() 
    {
        window.setInterval(() => 
        {
            const now = Date.now();
            
            const map = this._removedComponentsMap;
            for (const [component, time] of map.entries()) 
            {
                if (now - time > 1000) 
                {
                    if (component.dnited !== true) this._app.consoleUtil.error(DebugUtil, 'Component was removed but not dnited', component);
                    
                    map.delete(component);
                    continue;
                }

                //since Map maintains insertion order and we've hit an entry that's not older than 1 second, we can safely break out of the loop.
                break;
            }
        }, 500);  
    }
}
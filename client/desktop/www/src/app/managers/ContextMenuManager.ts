/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import html from "./ContextMenuManager.html";
import type { IContextMenuData, IContextMenuItemData } from "../../library/managers/IContextMenuManager.ts";
import { ContextMenuManager as SharedContextMenuManager } from "../../library/managers/ContextMenuManager.ts";
import type { IBaseApp } from "../../library/IBaseApp.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { DevEnvironment } from "../../../../../../shared/src/library/IEnvironment.ts";

class Elements 
{
    contextMenu!:HTMLElement;
}

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
export class ContextMenuManager<A extends IBaseApp<A>> extends SharedContextMenuManager<A>
{
    private _elements = new Elements();

    constructor(app:A, destructor:IDestructor<A>) 
    {
        const contextMenuContainer = document.createElement('div');
        contextMenuContainer.setAttribute('data-treeview', '{"skip":"true"}'); //hide from the treeview component
        contextMenuContainer.classList.add('app-managers-ContextMenuManager');

        const documentFragment = app.domUtil.createDocumentFragment(html);
        contextMenuContainer.appendChild(documentFragment);
        document.body.appendChild(contextMenuContainer);

        super(app, destructor, contextMenuContainer);
        
        app.domUtil.set(contextMenuContainer, this._elements);
    }

    protected override onContextMenuClicked(event:MouseEvent, data:IContextMenuData):void
    {
        let label = (event.target as HTMLElement).getAttribute('data-label');
        if (!label) return;

        //recersive function to find the handler for the clicked item
        const findContextMenuItem = (items?:Array<IContextMenuItemData>):IContextMenuItemData | undefined =>
        {
            if (!items) return undefined;

            for (let item of items)
            {
                if (item.label == label) return item;
                if (item.items) 
                {
                    const result = findContextMenuItem(item.items);
                    if (result) return result;
                }
            }

            return undefined;
        };

        let contextMenuItem = findContextMenuItem(this._contextMenuData?.items);
        if (!contextMenuItem) 
        {
            this.warn('Context menu item not found');
            return;
        }

        if (!contextMenuItem.action) 
        {
            this.warn('Context menu item action not found');
            return;
        }
        
        contextMenuItem.action();
    }

    protected override hideContextMenu()
    {
        super.hideContextMenu();

        this._elements.contextMenu.style.display = 'none';
        this._elements.contextMenu.innerHTML = '';
    }

    protected override showContextMenu(event:MouseEvent, data:IContextMenuData)
    {   
        super.showContextMenu(event, data);

        const contextMenu = this._elements.contextMenu;

        //if (!document.hasFocus()) return; //don't show custom menu if the document doesn't have focus

        contextMenu.style.display = 'block'; //show custom menu
        contextMenu.style.left = event.clientX + 'px'; //position custom menu
        contextMenu.style.top = event.clientY + 'px';

        if (this._app.environment.frozen.devEnvironment !== DevEnvironment.Prod) //add debug options
        {
            data.items.push({});
            data.items.push({label:"Disable Context Menu", action:() => this.disableContextMenu()});
            //data.items.push({label:"Show Grid Outline", action:() => this._transient.desktopComponent.showGridOutline()});
        }

        const labels = new Set<string>();
        const createMenuItemHTML = (items:Array<IContextMenuItemData>):string =>
        {
            let html = '';
            for (let item of items)
            {
                if (!item.label)
                {
                    html += `<li><hr></li>`;
                    continue;
                }

                if (!item.label) throw new Error('Context menu item must have a label');
                if (labels.has(item.label)) throw new Error('Context menu item label must be unique');
                labels.add(item.label);

                html += `<li>`;
                html += `<a data-label="${item.label}" class="dropdown-item" href="#">${item.items ? item.label + ' &raquo;' : item.label}</a>`;
                if (item.items && item.items.length) 
                {
                    html += `<ul class="dropdown-menu dropdown-submenu">`;
                    html += createMenuItemHTML(item.items);
                    html += `</ul>`;
                }
                html += `</li>`;
            }

            return html;
        }

        contextMenu.innerHTML = createMenuItemHTML(data.items);
    }
}
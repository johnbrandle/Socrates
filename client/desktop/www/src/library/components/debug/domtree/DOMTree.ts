/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import html from './DOMTree.html';
import { ComponentDecorator } from '../../../decorators/ComponentDecorator';
import type { IScreen } from '../../IScreen';
import { IScreenType } from '../../IScreen';
import type { IViewer } from '../../view/IViewer';
import type { IView } from '../../view/IView';
import { IViewType } from '../../view/IView';
import { IViewerType } from '../../view/IViewer';
import { Component } from '../../Component';
import type { IBaseApp } from '../../../IBaseApp';
import { DOMTreeView } from './DOMTreeView';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor';

export class Elements
{
    output!:HTMLElement;
}

@ComponentDecorator()
export class DOMTree<A extends IBaseApp<A>> extends Component<A>
{
    private _treeView:DOMTreeView<A> | undefined;

    private _map:Map<Element, Element> = new Map();

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init(...args:any):Promise<void>
    { 
        this.set(this._elements);

        await super.init();
    }

    public override async ready():Promise<void>
    {
        super.ready();

        const getContent = (text:string, color?:string) =>
        {
            const span = document.createElement('span');
            if (color) span.style.color = color;
            span.innerText = text;
            return span;
        }

        this._treeView = new DOMTreeView(this._app, this, document.body, this._elements.output, (element, node) => 
        {
            let color = '';
            const nodeName = element.nodeName.toLowerCase();
            switch(nodeName)
            {
                case 'script':
                case 'style':
                    return {skip:true};
            }

            const data = element.getAttribute('data-treeview');
            if (data) return JSON.parse(data);

            let obj:{content:HTMLElement, skipChildren?:boolean};
            if (element.component)
            {
                const component = element.component;
                const title = component.className + ' (' + component.fullyQualifiedName + ')';

                if (this._app.typeUtil.is<IView<any>>(component, IViewType))
                {
                    if (component.viewer !== undefined && (component.viewer.current !== component || component.loaded === false)) color = 'grey';
                    else if (this._app.typeUtil.is<IViewer<any>>(component, IViewerType)) color = 'gold';
                }

                if (component instanceof Window) obj = {content:getContent(title, color), skipChildren:true};
                else if (component.transparent === true || this._app.typeUtil.is<IScreen<any>>(component, IScreenType)) obj = {content:getContent(title, color)};
                else obj = {content:getContent(title, color), skipChildren:true};
            }
            else obj = {content:getContent(nodeName, color)};

            const previousColor = obj.content.style.color;
            obj.content.addEventListener('click', (event) =>
            {
                event.stopImmediatePropagation();

                if (event.shiftKey === true)
                {
                    if (element.component?.debug === undefined) return;

                    if (element.component.debug.showing === true) 
                    {
                        obj.content.style.color = previousColor;
                        element.component.debug.hide();
                    }
                    else 
                    {
                        obj.content.style.color = 'green';
                        element.component.debug.show();
                    }
                }

                obj.skipChildren = !obj.skipChildren;
                this._treeView?.skipChildren(element, obj.skipChildren);
            }, {capture:true, passive:true});

            return obj;
        }, (element:Element | undefined, node:Element) => 
        {
        });        
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}

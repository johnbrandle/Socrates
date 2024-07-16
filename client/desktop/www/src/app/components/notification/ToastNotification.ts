/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Component } from '../../../library/components/Component.ts';
import type { IApp } from '../../IApp.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import html from './ToastNotification.html';
import bootstrap from 'bootstrap';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { EventListenerAssistant } from '../../../library/assistants/EventListenerAssistant.ts';

class Elements 
{
    template!:HTMLTemplateElement;
}

class TemplateElements
{
    toast!:HTMLElement;
    title!:HTMLElement;
    message!:HTMLElement;
}

@ComponentDecorator()
export class ToastNotification<A extends IApp<A>> extends Component<A> 
{
    public static TYPE_SUCCESS:string = 'bg-success';
    public static TYPE_WARNING:string = 'bg-warning';
    public static TYPE_DANGER:string = 'bg-danger';

    private _eventListenerAssitant!:EventListenerAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html); 
    }

    public override async init(...args: any):Promise<void>
    {
        this.set(this._elements);

        this._eventListenerAssitant = new EventListenerAssistant(this._app, this);
        
        return super.init();
    }

    public show(message:string, type:string, title:string='Notification'):void
    {
        const toastTemplate = (this._elements.template.content.cloneNode(true) as DocumentFragment).firstElementChild;
        let templateElements = new TemplateElements();
        this.set(templateElements, toastTemplate!);
        
        this._element.append(templateElements.toast);

        templateElements.toast.classList.add(type);
        templateElements.message.innerHTML = message;
        templateElements.title.innerHTML = title;
        const toast = new bootstrap.Toast(templateElements.toast, { autohide: true, delay: 3000 });
        toast.show();
        
        this._eventListenerAssitant.subscribe(templateElements.toast, 'hidden.bs.toast', () => templateElements.toast.remove(), {once:true});
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
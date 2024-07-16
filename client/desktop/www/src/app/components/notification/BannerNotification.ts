/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Component } from '../../../library/components/Component.ts';
import type { IApp } from '../../IApp.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import html from './BannerNotification.html';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';

class Elements 
{
    template!:HTMLTemplateElement;
}

class TemplateElements
{
    alert!:HTMLElement;
    message!:HTMLElement;
}

@ComponentDecorator()
export class BannerNotification<A extends IApp<A>> extends Component<A> 
{
    public static TYPE_PRIMARY:string = 'alert-primary';

    private _modal:any;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html); 
    }

    public override async init(...args:any):Promise<void>
    {
        this.set(this._elements);

        return super.init();
    }

    public show(message:string, type:string=BannerNotification.TYPE_PRIMARY):void
    {
        const template = (this._elements.template.content.cloneNode(true) as DocumentFragment).firstElementChild;
        let templateElements = new TemplateElements();
        this.set(templateElements, template!);
        
        this._element.append(templateElements.alert);

        templateElements.alert.classList.add(type);
        templateElements.message.innerHTML = message;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
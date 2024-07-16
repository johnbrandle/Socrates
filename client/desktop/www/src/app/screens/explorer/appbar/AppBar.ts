/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../../IApp.ts';
import { Component } from '../../../../library/components/Component.ts';
import { Signal } from '../../../../../../../../shared/src/library/signal/Signal.ts';
import html from './AppBar.html';
import type { ISignal } from '../../../../../../../../shared/src/library/signal/ISignal.ts';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import type { IContextMenuData } from '../../../../library/managers/IContextMenuManager.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';
import { EventListenerAssistant } from '../../../../library/assistants/EventListenerAssistant.ts';

class Elements 
{
}

@ComponentDecorator()
export class AppBar<A extends IApp<A>> extends Component<A>
{
    public readonly onAppOpenSignal = new Signal<[AppBar<A>, string, number, number]>(this);

    private _eventListenerAssistant!:EventListenerAssistant<A>;

	constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
	{
		super(app, destructor, element, html);
	}

    public override async init(...args:any):Promise<void>
	{
        const promise = super.init();

        this.set(this._elements);

        this._eventListenerAssistant = new EventListenerAssistant(this._app, this);
        this._eventListenerAssistant.subscribe(this._element, 'click', this.#onClicked);

        return promise;
	}

    #onClicked = (event:MouseEvent):void =>
    {
        event.preventDefault();
        event.stopImmediatePropagation();

        this.onAppOpenSignal.dispatch(this, (event.target as HTMLElement)?.getAttribute('data-id') || '', event.clientX, event.clientY);
    }

    public onContextMenu(event:MouseEvent):IContextMenuData | undefined
    {
        const target = (event.target ?? undefined) as Element | undefined;
        if (target === undefined) return;

        if (this.element.contains(target) !== true) return;

        const contextMenuData:IContextMenuData = { items:[] };

        return contextMenuData;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
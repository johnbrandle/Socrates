/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../../IApp.ts';
import { Component } from '../../../../library/components/Component.ts';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import html from './ControlBar.html';
import type { IContextMenuData } from '../../../../library/managers/IContextMenuManager.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';
import { EventListenerAssistant } from '../../../../library/assistants/EventListenerAssistant.ts';
import { Signal } from '../../../../../../../../shared/src/library/signal/Signal.ts';

class Elements 
{
    aboutItem!:HTMLLIElement;
    settingsItem!:HTMLLIElement;
    logoutItem!:HTMLLIElement;
    lockItem!:HTMLLIElement;
}

@ComponentDecorator()
export class ControlBar<A extends IApp<A>> extends Component<A>
{
    public readonly onAppOpenSignal = new Signal<[ControlBar<A>, string, number, number]>(this);

    private _eventListenerAssistant!:EventListenerAssistant<A>;

	constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
	{
		super(app, destructor, element, html);
	}

    public override async init(...args:any):Promise<void>
	{
        let promise = super.init();

        this.set(this._elements);

        const eventListenerAssistant = this._eventListenerAssistant = new EventListenerAssistant(this._app, this, this);

        eventListenerAssistant.subscribe(this._elements.aboutItem, 'click', () => 
        {
            this._app.dialogUtil.html(this, 
                {
                    title:'About', 
                    html:`Version...
            `});
        });

        eventListenerAssistant.subscribe(this._elements.settingsItem, 'click', (event:MouseEvent) =>
        {
            this.onAppOpenSignal.dispatch(this, 'systemsettings', event.clientX, event.clientY);
        });
        
        eventListenerAssistant.subscribe(this._elements.logoutItem, 'click', async () =>
        {
            await this._app.userManager.logout();
            location.reload();
        });

        eventListenerAssistant.subscribe(this._elements.lockItem, 'click', () =>
        {
            //add options in the settings to logout if too many failed attempts and/or after a certain amount of time.
            //or after processes (such as a copy or download) are done running in the background.
            alert('todo: should lock the screen without logging out. allowing processes to continue running in the background.');
        });

        //this._app.model.onLoginSignal.add(this, (loggedIn:boolean) => this.render(loggedIn));

        //this._elements.status.innerText = 'Online Status: ' + this._app.networkManager.status;
        //this._app.networkManager.onStatusChangedSignal.subscribe((status:Status) => 
        //{
            //this._elements.status.innerText = 'Online Status: ' + status;
        //});

        return promise;
	}

    public onContextMenu(event:MouseEvent):IContextMenuData | undefined
    {
        const target = (event.target ?? undefined) as Element | undefined;
        if (target === undefined) return;

        if (!this.element.contains(target)) return;

        const contextMenuData:IContextMenuData = { items: [] };

        return contextMenuData;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
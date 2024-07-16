/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../../IApp.ts';

import html from './NetworkMonitor.html';
import { Window, type IWindowDisplayOptions, type IWindowStorage } from '../../../screens/explorer/window/Window.ts';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import { WindowElements } from '../../../screens/explorer/window/WindowElements.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';

export class Elements extends WindowElements
{
    //stats!:HTMLElement;
}

@ComponentDecorator()
export class NetworkMonitor<A extends IApp<A>> extends Window<A>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, appID:string, windowID:string, storage:IWindowStorage<A>, displayOptions?:IWindowDisplayOptions) 
    {
        super(app, destructor, element, appID, windowID, storage, displayOptions);
    }

	protected override preprocessHTML(element:HTMLElement):HTMLElement
	{ 
        const contentContainer = this.get<HTMLElement>('windowContent', element, false);
        if (!contentContainer) throw new Error('Could not find window content container');

        contentContainer.innerHTML = html;

        return super.preprocessHTML(element);
	}

    public override async init(...args:any):Promise<void>
    { 
        this.set(this._elements);

        await super.init();

        this.title = this.appName;
    }

    public override async ready():Promise<void>
    {
        super.ready();
    }

    public override get appName()
    {
        return 'Network Monitor';
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from '../../../IBaseApp';

import html from './GCMonitor.html';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import { Component } from '../../Component';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';
import { IntervalAssistant } from '../../../assistants/IntervalAssistant.ts';

export class Elements
{
    output!:HTMLElement;
}

@ComponentDecorator()
export class GCMonitor<A extends IBaseApp<A>> extends Component<A>
{
    private _intervalAssistant:IntervalAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);

        this._intervalAssistant = new IntervalAssistant(app, this);
    }

    public override async init(...args:any):Promise<void>
    { 
        this.set(this._elements);

        await super.init();
    }

    public override async ready():Promise<void>
    {
        super.ready();

        this._intervalAssistant.start(this.#interval, 250);      
    }

    #interval = () =>
    {
        const time = performance.now();
        const pendingGC = this._app.gcUtil.getPending();
        
        const sorted = Array.from(pendingGC.entries()).sort((a, b) => 
        {
            return a[1] - b[1];
        });
        
        let fragment = new DocumentFragment();
        let count = 0;
        for (const [object, aliveTime] of sorted)
        {
            const diff = time - aliveTime;
            const seconds = Math.floor(diff / 1000);

            count++;
            const line = document.createElement('div');
            line.textContent = `${object.className} - ${seconds}`;
            fragment.appendChild(line);
        }

        if (count === 0) fragment.appendChild(document.createTextNode('No pending objects to GC'));

        const elements = this._elements;

        elements.output.innerHTML = '';
        elements.output.appendChild(fragment);
        this._element.scrollTop = this._element.scrollHeight;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
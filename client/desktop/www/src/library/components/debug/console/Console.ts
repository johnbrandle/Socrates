/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import html from './Console.html';
import { GlobalEvent } from '../../../../library/managers/GlobalListenerManager.ts';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import type { IBaseApp } from '../../../IBaseApp.ts';
import { Component } from '../../Component.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';

export class Elements
{
    consoleOutput!:HTMLElement;
}

@ComponentDecorator()
export class Console<A extends IBaseApp<A>> extends Component<A>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init(...args:any):Promise<void>
    { 
        this.set(this._elements);
        
        await super.init();

        this._app.globalListenerManager.subscribe(this, GlobalEvent.ConsoleLog, this.onConsoleLogListened);

        let logs = this._app.consoleUtil.earlyLogs;
        if (logs) logs.forEach((logItem) => this.appendLine(this._app.consoleUtil.logArgsToHTML(logItem)));
    }

    public onConsoleLogListened = (event:CustomEvent) =>
    {
        this.appendLine(this._app.consoleUtil.logArgsToHTML(event.detail))
    }

    public appendLine(line:HTMLElement): void
    {
        this._elements.consoleOutput.appendChild(line);
        this._element.scrollTop = this._element.scrollHeight;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
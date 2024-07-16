/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../../IApp.ts';

import html from './Share.html';
import { Window, type IWindowDisplayOptions, type IWindowStorage } from '../../../screens/explorer/window/Window.ts';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import { WindowElements } from '../../../screens/explorer/window/WindowElements.ts';
import { DragAssistant } from '../../../assistants/DragAssistant.ts';
import { SignalAssistant } from '../../../../library/assistants/SignalAssistant.ts';
import { easeOutQuad } from '../../../../library/assistants/TweenAssistant.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';

class Elements extends WindowElements
{   
    homeButton!:HTMLElement;
    backButton!:HTMLElement;
    forwardButton!:HTMLElement;
    upButton!:HTMLElement;
    pathTextField!:HTMLInputElement;
    
    filterOptionsButton!:HTMLElement;
    filterOptionsPanel!:HTMLElement;
    typeButtons!:Array<HTMLButtonElement>;
    bytesSlider!:HTMLElement;
    lastModifiedSlider!:HTMLElement;
    resetButton!:HTMLElement;

    displayOptionButtons!:Array<HTMLButtonElement>;

    sidebar!:HTMLElement;

    /*
    sidebarView!:HTMLElement;
    */

    resizeDivider!:HTMLElement;

    /*
    boardViewer!:HTMLElement;
    gridView!:HTMLElement;
    rowView!:HTMLElement;
    treeView!:HTMLElement;
    */

    footer!:HTMLElement;
}

@ComponentDecorator()
export class Share<A extends IApp<A>> extends Window<A>
{
    private _signalAssistant!:SignalAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, appID:string, windowID:string, storage:IWindowStorage<A>, displayOptions?:IWindowDisplayOptions) 
    {
        super(app, destructor, element, appID, windowID, storage, displayOptions);
    }

	protected override preprocessHTML(element:HTMLElement):HTMLElement
	{ 
        element = super.preprocessHTML(element);
        
        const contentContainer = this.get<HTMLElement>('windowContent', element, false);
        if (!contentContainer) throw new Error('Could not find window content container');

        contentContainer.innerHTML = html;

        return element;
	}

    public override async init(...args:any):Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._signalAssistant = new SignalAssistant(this._app, this);

        this.title = this.appName; //set window title

        this.#initResizeDivider();

        return super.init();
    }

    public override async ready():Promise<void>
    {
        return super.ready();
    }

    #initResizeDivider():void
    {
        const elements = this._elements;

        new DragAssistant(this._app, this, elements.resizeDivider, () => {}, 
        () => 
        {
            return {momentum:{multiplier:50, threshold:5, max:40, duration:500, ease:easeOutQuad}};
        }, (_dragAssistant:DragAssistant<A>, _event:PointerEvent, _startX:number, _startY:number, deltaX:number, _deltaY:number) => 
        { 
            let currentWidth = elements.sidebar.offsetWidth;

            let newWidth = currentWidth + deltaX;
            elements.sidebar.style.width = newWidth + 'px';
        }, () => {}, 0);
    }

    public override get appName() { return 'Share'; }
    public override get minWidth():number { return 525; }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
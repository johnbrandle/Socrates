/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Component } from '../../../library/components/Component.ts';
import { GlobalEvent } from '../../../library/managers/GlobalListenerManager.ts';
import type { IApp } from '../../IApp.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import html from './BlurNotification.html';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';

class Elements 
{
    blurBanner!:HTMLElement;
}

@ComponentDecorator()
export class BlurNotification extends Component<IApp>
{
    constructor(app:IApp, destructor:IDestructor<IApp>, element:HTMLElement) 
    {
        super(app, destructor, element, html); 
    }

    public override async init(...args:any):Promise<void>
    {
        this.set(this._elements);

        this.onBlurListened();

        this._app.globalListenerManager.subscribe(this, GlobalEvent.Blur, this.onBlurListened);
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Focus, this.onFocusListened);

        return super.init();
    }

    public onFocusListened = ():void =>
    {
        this.onBlurListened();
    }

    public onBlurListened = ():void => 
    {
        let blurred = document.hasFocus() === false;
        
        const blurBanner = this._elements.blurBanner;
        if (blurred)
        {
            blurBanner.style.backdropFilter = 'blur(2px)';
            blurBanner.style.display = 'block';
        }
        else
        {
            blurBanner.style.backdropFilter = '';
            blurBanner.style.display = 'none';
        } 
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
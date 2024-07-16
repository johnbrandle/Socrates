/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../../IApp.ts';
import { View } from '../../../../library/components/view/View.ts';
import html from './PaymentOptionsView.html';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';

class Elements
{
    cashPaymentOption!:HTMLElement;
    giftCardPaymentOption!:HTMLElement;
    cryptoPaymentOption!:HTMLElement;
}

@ComponentDecorator()
export class PaymentOptionsView extends View<IApp>
{
    constructor(app:IApp, destructor:IDestructor<IApp>, element:HTMLElement)
    {
        super(app, destructor, element, html);
    }

	public override async init(...args:any):Promise<void> 
	{
        const elements = this._elements;
    
        this.set(elements);

		let promise = super.init(); 

        elements.cashPaymentOption.onclick = () => this.goto(this.next!);

        return promise;
	}

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}

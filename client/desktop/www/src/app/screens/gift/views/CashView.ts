/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { WalletCashGiftCardValue } from '../../../../../../../../shared/src/app/json/WalletJSON.ts';
import { ErrorJSONObject } from '../../../../../../../../shared/src/app/json/ErrorJSONObject.ts';
import { View } from '../../../../library/components/view/View.ts';
import html from './CashView.html';
import type { IApp } from '../../../IApp.ts';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import { CharSet } from '../../../../library/utils/BaseUtil.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';

class CashViewElements
{
    backButton!:HTMLButtonElement;
    printButton!:HTMLButtonElement;
    termsCheckbox!:HTMLInputElement;
    printable!:HTMLTemplateElement;
}

class PrintableElements
{
    randomCode!:HTMLSpanElement; //used to track mail theft
    activationQRcode!:HTMLDivElement; 
}

@ComponentDecorator()
export class CashView<A extends IApp<A>> extends View<A>
{
    private _activationCode:string = '';
    private _tokens:number = 0;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement)
    {
        super(app, destructor, element, html);
    }

	public override async init(...args:any):Promise<void> 
	{
        const elements = this._elements;

        this.set(elements);

		let promise = super.init(); 

        elements.backButton.onclick = () => this.goto(this.previous!);
        elements.printButton.onclick = async () => this.printGiftCard();

        return promise;
	}

    private async printGiftCard()
    {
        let result = await this._app.walletManager.walletCreateGift({activationValue:WalletCashGiftCardValue.FIFTY, onActivationTransferToWalletID:''}); //todo
        if (result instanceof ErrorJSONObject) 
        {
            //TODO, do somethin
            return;
        }

        const printable = this._app.domUtil.clone(this._elements.printable.content).firstElementChild! as HTMLElement;

        //copy over classnames
        this.element.classList.forEach((className:string) => printable.classList.add(className));
        
        let printableElements = new PrintableElements();
        
        this.set(printableElements, printable);

        let activationCode = result.activationCode;
        let tokens = result.tokens;
        
        printableElements.randomCode.textContent = this._app.textUtil.generate(8, {charset:CharSet.Base24});

        let canvas = this._app.qrCodeUtil.create(activationCode, false);
        canvas.title = activationCode; 
        
        let img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        printableElements.activationQRcode.append(img);

        this._app.dataUtil.print('SocratesOS.com - Token Purchase Request', printable, async (window:Window) => 
        {
            window.close();
            let result = await this._app.dialogUtil.confirm(this, {html:'All done?', confirmText:'Yes', cancelText:'No, I need to print again'});

            //if (result) (this._component as Gift).gotoNextScreen();
        });
    }

    protected override get _elements():CashViewElements { return this.__elements ?? (this.__elements = new CashViewElements()); }
}
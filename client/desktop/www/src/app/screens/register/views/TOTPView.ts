/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../IApp.ts";
import { View } from "../../../../library/components/view/View.ts";
import html from './TOTPView.html';
import { Register } from "../Register.ts";
import { ComponentDecorator } from "../../../../library/decorators/ComponentDecorator.ts";
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor.ts";
import { EventListenerAssistant } from "../../../../library/assistants/EventListenerAssistant.ts";
import { CharSet } from "../../../../library/utils/BaseUtil.ts";
import { ErrorJSONObject } from "../../../../../../../../shared/src/app/json/ErrorJSONObject.ts";
import { RegisterLoginStatus } from "../../../managers/UserManager.ts";
import { type totp, type totpsecret } from "../../../../../../../../shared/src/app/utils/TOTPUtil.ts";
import { Progressor } from "../../../../../../../../shared/src/library/progress/Progressor.ts";
import type { Turn } from "../../../../../../../../shared/src/library/basic/Turner.ts";

class Elements
{
    helpLink!:HTMLAnchorElement;
    totpQRcode!:HTMLDivElement;
    totpTextField!:HTMLInputElement;
    submitButton!:HTMLButtonElement;
}

@ComponentDecorator()
export class TOTPView<A extends IApp<A>> extends View<A>
{
    public register!:Register<A>;

    private _secret!:totpsecret;

    private _eventListenerAssistant!:EventListenerAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement)
    {
        super(app, destructor, element, html);
    }

	public override async init(...args:any):Promise<void> 
	{
        await super.init();

        const elements = this._elements;

        this.set(elements);

        this._eventListenerAssistant = new EventListenerAssistant(this._app, this);

        const name = this._app.textUtil.generate(6, {charset:CharSet.Base62});
        const secret = this._secret = this._app.totpUtil.generateSecret();

        const text = `otpauth://totp/${name}@socratesos.com?secret=${secret}&issuer=SocratesOS.com`;
        const canvas = this._app.qrCodeUtil.create(text);
        canvas.title = text; 
        elements.totpQRcode.appendChild(canvas);

        elements.submitButton.disabled = true;

        return super.init();
    }

    public override async ready():Promise<void>
    {
        await super.ready();

        const elements = this._elements;
        const eventListenerAssistant = this._eventListenerAssistant;

        eventListenerAssistant.subscribe(elements.totpTextField, 'input', this.#onTOTPTextFieldInput);
        eventListenerAssistant.subscribe(elements.helpLink, 'click', this.#onHelpLinkClicked);
        eventListenerAssistant.subscribe(elements.submitButton, 'click', this.#onSubmitButtonClicked);
    }
    
    public override async onShow():Promise<void>
    {
        this._elements.totpTextField.focus();
    }

    #onTOTPTextFieldInput = () =>
    {
        const elements = this._elements;

        elements.totpTextField.value = elements.totpTextField.value.replace(/[^0-9 ]/, '');
            
        const noSpaces = elements.totpTextField.value.replace(/\s/g, '');
        
        elements.submitButton.disabled = noSpaces.length !== 8;
    }

    #onHelpLinkClicked = () =>
    {
        this._app.dialogUtil.html(this, {title:'Unable to scan the QR code?', html:`<span class="screens-Register">Alternatively, you can manually enter this secret key into your authentication app: "<span class="secret">${this._secret}</span>". Please keep this key secure and do not share it with anyone.</span>`});
    }

    #onSubmitButtonClicked = async ():Promise<void> =>
    {
        //get the abortable helper
        const _ = this.abortableHelper.throwIfAborted();

        let turn:Turn<A> | undefined;

        try
        {
            //throw if aborted
            _.throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
            const totp = this._elements.totpTextField.value.replace(/\s/g, '') as totp;

            const progressor = new Progressor<A, {status:RegisterLoginStatus, details:string}, ErrorJSONObject>(this._app, () => true, this);        
            const success = _.value(await this.register.register(this.register.keyView.key, totp, this._secret, progressor, {rounds:this.register.keyView.rounds, iterations:this.register.keyView.iterations, memory:this.register.keyView.memory}));
    
            if (success !== true) return;
    
            _.check(await this.goto(this.next!));
        }
        catch (error)
        {
            this._app.warn(error, 'failed to register user account', [], {names:[TOTPView, this.#onSubmitButtonClicked]});

            if (_.aborted() === undefined) await this.goto(this.previous!);
        }
        finally
        {
            turn?.end();
        }
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
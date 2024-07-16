/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../IApp.ts";
import { View } from "../../../../library/components/view/View.ts";
import html from './TOTPView.html';
import { Login } from "../Login.ts";
import { ComponentDecorator } from "../../../../library/decorators/ComponentDecorator.ts";
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor.ts";
import { EventListenerAssistant } from "../../../../library/assistants/EventListenerAssistant.ts";
import { RegisterLoginStatus } from "../../../managers/UserManager.ts";
import type { totp } from "../../../../../../../../shared/src/app/utils/TOTPUtil.ts";
import { Progressor } from "../../../../../../../../shared/src/library/progress/Progressor.ts";
import type { Turn } from "../../../../../../../../shared/src/library/basic/Turner.ts";

class Elements
{
    helpLink!:HTMLAnchorElement;
    totpTextField!:HTMLInputElement;
    loginButton!:HTMLButtonElement;
}

@ComponentDecorator()
export class TOTPView<A extends IApp<A>> extends View<A>
{
    public login!:Login<A>;

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

        this._eventListenerAssistant = new EventListenerAssistant<A>(this._app, this);

        elements.loginButton.disabled = true;
    }

    public override async ready():Promise<void>
    {
        await super.ready();

        const elements = this._elements;
        const eventListenerAssistant = this._eventListenerAssistant;

        eventListenerAssistant.subscribe(elements.helpLink, 'click', this.#onHelpLinkClicked);
        eventListenerAssistant.subscribe(elements.totpTextField, 'input', this.#onTotpTextFieldInput);
        eventListenerAssistant.subscribe(elements.loginButton, 'click', this.#onLoginButtonClicked);
    }

    public override async onShow():Promise<void>
    {
        this._elements.totpTextField.focus();
    }

    #onHelpLinkClicked = () => this._app.dialogUtil.html(this, {title:'Can\'t find your code?', html:`Codes change every 30 seconds. Get your new 6 digit code in the authenticator app you used when registering your account.`});

    #onTotpTextFieldInput = () =>
    {
        const elements = this._elements;

        elements.totpTextField.value = elements.totpTextField.value.replace(/[^0-9 ]/, '');
        
        const noSpaces = elements.totpTextField.value.replace(/\s/g, '');
        
        elements.loginButton.disabled = noSpaces.length !== 8;
    }

    #onLoginButtonClicked = async ():Promise<void> =>
    {
        const progressModal = this._app.progressModal;

        let turn:Turn<A> | undefined;

        try
        {
            //get the abortable helper
            const _ = this.abortableHelper.throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
            const totp = this._elements.totpTextField.value.replace(/\s/g, '') as totp;

            //show progress modal
            progressModal.show(this);
            progressModal.title = 'Please wait to be logged in';
    
            const progressor = new Progressor<A, {status:RegisterLoginStatus, details:string}>(this._app, (progress, data) => 
            {
                const {status, details} = data;
    
                switch (status)
                {
                    case RegisterLoginStatus.HardenKey_Begin:
                        progressModal.status = 'Hardening your key...';
                        progressModal.appendDetail('beginning key hardening');
                        progressModal.appendDetail(`0.00% complete`);
                        break;
                    case RegisterLoginStatus.HardenKey_Progress:
                        progressModal.appendDetail(`${details}% complete`, true);
                        break; 
                    case RegisterLoginStatus.Failed:
                        progressModal.status = 'Error';   
                        progressModal.appendDetail(details);
                    case RegisterLoginStatus.Other:
                        progressModal.appendDetail(details);
                        break;   
                }
    
                progressModal.progress = progress;
    
                return true;
            }, this);
    
            const result = _.value(await this._app.userManager.login(this.login.keyView.key, totp, progressor), {allowFailure:true});

            if (result !== true)
            {
                //update the progress model and hide it
                progressModal.status = 'Error';
                progressModal.appendDetail(result.value.details);
                const [didHide, onHiddenPromise] = progressModal.hide();
                
                _.check(await onHiddenPromise);

                if (didHide === true) _.check(await this._app.dialogUtil.error(this, {title:'Error', html:'Something went wrong. Please try again.'}));
        
                return;
            }

            progressModal.title = 'Please press continue to proceed';
            progressModal.status = 'Done!';
            progressModal.appendDetail('success');
            const [_didHide, onHiddenPromise] = progressModal.hide();

            _.check(await onHiddenPromise);
            _.check(await this.login.gotoNextScreen());
        }
        catch (e)
        {
            await progressModal.hide(true);

            const error = this._app.warn(e, 'failed to login user account for unknown reason', [], {names:[this.constructor, this.#onLoginButtonClicked]});

            if (error.aborted === undefined) await this._app.dialogUtil.error(this, {title:'Error', html:'Something went wrong. Please try again.', detailsHTML:String(e)});
        }
        finally
        {
            turn?.end();
        }
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
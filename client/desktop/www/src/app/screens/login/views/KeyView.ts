/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../IApp.ts";
import { CenteredTextHelper } from "../../../helpers/CenteredTextHelper.ts";
import { View } from "../../../../library/components/view/View.ts";
import html from './KeyView.html';
import type { Login } from "../Login.ts";
import { MaskedTextAssistant } from "../../../assistants/MaskedTextAssistant.ts";
import { ComponentDecorator } from "../../../../library/decorators/ComponentDecorator.ts";
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor.ts";
import { EventListenerAssistant } from "../../../../library/assistants/EventListenerAssistant.ts";
import type { Turn } from "../../../../../../../../shared/src/library/basic/Turner.ts";
import { RegisterLoginStatus } from "../../../managers/UserManager.ts";
import { Progressor } from "../../../../../../../../shared/src/library/progress/Progressor.ts";

class Elements
{
    keyTextField!:HTMLInputElement;
    lostButton!:HTMLButtonElement;
    loginButton!:HTMLButtonElement;
    visibilityButton!:HTMLButtonElement;
}

@ComponentDecorator()
export class KeyView<A extends IApp<A>> extends View<A>
{
    private _centeredTextHelper!:CenteredTextHelper<A>;
    private _maskedTextAssistant!:MaskedTextAssistant<A>;

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

        const keyTextField = elements.keyTextField;
        
        this._centeredTextHelper = new CenteredTextHelper<A>(this._app, keyTextField);
        this._maskedTextAssistant = new MaskedTextAssistant<A>(this._app, this, keyTextField);
    }

    public override async ready():Promise<void>
    {
        await super.ready();
    
        const elements = this._elements;

        this._maskedTextAssistant.onUpdateSignal.subscribe(this, this.#onMaskedTextAssistantUpdate);

        this._eventListenerAssistant.subscribe(elements.visibilityButton, 'click', this.#onVisibilityButtonClicked);
        this._eventListenerAssistant.subscribe(elements.lostButton, 'click', this.#onLostButtonClicked);
        this._eventListenerAssistant.subscribe(elements.loginButton, 'click', this.#onLoginButtonClicked);
    }

    public override async onShow():Promise<void>
    {
        const elements = this._elements;

        elements.keyTextField.value = '';

        this._centeredTextHelper.update(elements.visibilityButton.offsetWidth + elements.lostButton.offsetWidth);
    
        elements.keyTextField.focus();
    }

    public override async onResize():Promise<void>
    {
        const elements = this._elements;

        this._centeredTextHelper.update(elements.visibilityButton.offsetWidth + elements.lostButton.offsetWidth);
    }

    #onMaskedTextAssistantUpdate = () => 
    {
        const elements = this._elements;

        this._centeredTextHelper.update(elements.visibilityButton.offsetWidth + elements.lostButton.offsetWidth); 
        
        elements.loginButton.disabled = !elements.keyTextField.value;
    }

    #onVisibilityButtonClicked = () =>
    {
        const element = this._elements.visibilityButton.firstElementChild!;
        element.classList.remove('bi-eye-slash');
        element.classList.remove('bi-eye');
        
        if (this._maskedTextAssistant.maskingEnabled) 
        {
            element.classList.add('bi-eye'); 
            this._maskedTextAssistant.disableMasking();
        }
        else 
        {
            element.classList.add('bi-eye-slash');
            this._maskedTextAssistant.enableMasking();
        }            
    }

    #onLostButtonClicked = () =>
    {
        this._app.dialogUtil.html(this, {title:'Misplaced your key?', html:`<p style="text-align: justify;">We don't store keys for security reasons. As a result, we're unable to assist you in 
        regaining access...<br/><br/>The good news? It takes about a minute to <a href="./register">create a new one</a>!</p>`});
    }

    #onLoginButtonClicked = async ():Promise<void> =>
    {
        /*
        let turn:Turn | undefined;

        try
        {
            //get the abortable helper
            const _ = this.abortableHelper.throwIfAborted();

            //get a turn
            turn = _.value(await this.getTurn());
            
            _.check(await this.goto(this.next!));
        }
        catch (error)
        {
            Error.warn(error, [KeyView, this.#onLoginButtonClicked], 'trouble going to next screen', []);
        }
        finally
        {
            turn?.end();
        }
        */

        const progressModal = this._app.progressModal;

        let turn:Turn<A> | undefined;

        try
        {
            //get the abortable helper
            const _ = this.abortableHelper.throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
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
    
            const result = _.value(await this._app.userManager.login(this.login.keyView.key, '', progressor), {allowFailure:true});

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

            const error = this._app.warn(e, 'failed to login user account for unknown reason', [], {names:[KeyView, this.#onLoginButtonClicked]});

            if (error.aborted === undefined) await this._app.dialogUtil.error(this, {title:'Error', html:'Something went wrong. Please try again.', detailsHTML:String(e)});
        }
        finally
        {
            turn?.end();
        }
    }

    public get key() { return this._maskedTextAssistant.text; }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
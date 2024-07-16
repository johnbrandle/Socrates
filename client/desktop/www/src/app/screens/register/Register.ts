/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import html from './Register.html';
import { Screen } from '../../../library/components/Screen.ts';
import { ToastNotification } from '../../components/notification/ToastNotification.ts';
import { AppRouter } from '../../router/AppRouter.ts';
import type { KeyView } from './views/KeyView.ts';
import type { TOTPView } from './views/TOTPView.ts';
import type { LoginView } from './views/LoginView.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { EventListenerAssistant } from '../../../library/assistants/EventListenerAssistant.ts';
import { DestructableEntity } from '../../../../../../../shared/src/library/entity/DestructableEntity.ts';
import { RegisterLoginStatus } from '../../managers/UserManager.ts';
import { type totp, type totpsecret } from '../../../../../../../shared/src/app/utils/TOTPUtil.ts';
import type { emptystring } from '../../../../../../../shared/src/library/utils/StringUtil.ts';
import type { IProgressor } from '../../../../../../../shared/src/library/progress/IProgressor.ts';
import { type IAborted } from '../../../../../../../shared/src/library/abort/IAborted.ts';
import type { IError } from '../../../../../../../shared/src/library/error/IError.ts';
import type { Turn } from '../../../../../../../shared/src/library/basic/Turner.ts';

class Elements 
{
    viewer!:HTMLDivElement;

    keyView!:HTMLDivElement;
    totpView!:HTMLDivElement;
    loginView!:HTMLDivElement;

    clipboardButtons!:Array<HTMLButtonElement>;
    printButtons!:Array<HTMLButtonElement>;
    downloadButtons!:Array<HTMLButtonElement>;
}

class Transient<A extends IApp<A>> extends DestructableEntity<A>
{
    elements:Elements;
 
    eventListenerAssistant:EventListenerAssistant<A>;

    keyView:KeyView<A>;
    totpView:TOTPView<A>;
    loginView:LoginView<A>; 

    constructor(app:A, destructor:IDestructor<A>, elements:Elements)
    {
        super(app, destructor);

        this.elements = elements;

        this.eventListenerAssistant = new EventListenerAssistant(app, this, destructor);

        this.keyView = elements.keyView.component as KeyView<A>;
        this.totpView = elements.totpView.component as TOTPView<A>;
        this.loginView = elements.loginView.component as LoginView<A>;
    } 

    public async ready():Promise<void>
    {
        const {clipboardButtons, printButtons, downloadButtons} = this.elements;
        const eventListenerAssistant = this.eventListenerAssistant;

        clipboardButtons.forEach(button => eventListenerAssistant.subscribe(button, 'click', this.#onClipboardButtonClicked)); //clipboard buttons
        printButtons.forEach(button => eventListenerAssistant.subscribe(button, 'click', this.#onPrintButtonClicked)); //print buttons
        downloadButtons.forEach(button => eventListenerAssistant.subscribe(button, 'click', this.#onDownloadButtonClicked)); //download buttons
    }

    #onClipboardButtonClicked = async () =>
    {
        let turn:Turn<A> | undefined;
        
        try
        {
            //create an abortable helper
            const _ = this.abortableHelper.throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
            const success = _.value(await this._app.dataUtil.copyToClipboard(this.keyView.key));
                
            if (success !== true) return this._app.toastNotification.show('Failed to copy text.', ToastNotification.TYPE_DANGER);
        
            this._app.toastNotification.show('Copied to clipboard. Please remember to paste it!', ToastNotification.TYPE_SUCCESS);
        }
        catch (e)
        {
            this._app.warn(e, 'failed to copy key to clipboard', [], {names:[this.constructor, this.#onClipboardButtonClicked]});
        }
        finally
        {
            turn?.end();
        }
    }

    #onPrintButtonClicked = () =>
    {
        window.print();
    }

    #onDownloadButtonClicked = () =>
    {
        this._app.dataUtil.download(this._app.name + '_key.txt', this.keyView.key);
    }

    public async gotoNextScreen():Promise<void>
    {
        await this._app.router.goto(AppRouter.ROUTE_EXPLORER);
    }

    public async register(key:string, totp:totp | emptystring, totpSecret:totpsecret | emptystring, progressor:IProgressor<A, {status:RegisterLoginStatus, details:string}>, options?:{rounds?:number, iterations?:number, memory?:number}):Promise<boolean | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        const progressModal = this._app.progressModal;

        try
        {
            //create an abortable helper
            const _ = this.createAbortableHelper(progressor).throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
            if (totpSecret === '') totpSecret = this._app.totpUtil.generateSecret(); //must be an offline login
            if (totp === '') totp = _.value(await this._app.totpUtil.derive(totpSecret, Math.floor(Date.now() / 1000)));
          
            //show progress modal
            const abortable = progressModal.show(this, {cancelable:true});
            progressModal.title = 'Please wait for your account to be created';

            progressor = progressor.slice(1, (progress, data) => 
            {
                const {status, details} = data;

                switch (status)
                {
                    case RegisterLoginStatus.HardenKey_Begin:
                        progressModal.status = 'Hardening your key...';
                        progressModal.appendDetail('beginning key hardening');
                        progressModal.appendDetail(`0.00% complete`, false);
                        break;
                    case RegisterLoginStatus.HardenKey_Progress:
                        progressModal.appendDetail(`${details}% complete`, true);
                        break; 
                    case RegisterLoginStatus.Failed:
                        progressModal.status = 'Error';
                        progressModal.appendDetail(details);
                        break;   
                    case RegisterLoginStatus.Other:
                        progressModal.appendDetail(details);
                        break;
                }

                progressModal.progress = progress;

                return true;
            });

            //add the progress modal abortable, so the progressor can abort if the user clicks the cancel button
            progressor.addAbortable(abortable);

            const result = _.value(await this._app.userManager.register(key, totp, totpSecret, progressor, options), {allowFailure:true});

            //if the registration failed, show the error and return
            if (result !== true)
            {
                //update the progress model and hide it
                progressModal.status = 'Error';
                progressModal.appendDetail(result.value.details);
                const [didHide, onHiddenPromise] = progressModal.hide();
                
                await onHiddenPromise;

                if (didHide === true) await this._app.dialogUtil.error(this, {title:'Error', html:'Something went wrong. Please try again.'});

                return false;
            }

            progressModal.title = 'Please press continue to proceed';
            progressModal.status = 'Done!';
            progressModal.appendDetail('account registration succesful');
            const [_didHide, onHiddenPromise] = progressModal.hide();

            await onHiddenPromise;

            return result;
        }
        catch (e)
        {
            await progressModal.hide(true);

            const error = this._app.warn(e, 'failed to register user account for unknown reason', [], {names:[this.constructor, this.register]});
            
            if (this._app.typeUtil.isAborted(error) !== true) await this._app.dialogUtil.error(this, {title:'Error', html:'Something went wrong. Please try again.', detailsHTML:String(e)});

            return error;
        }
        finally
        {
            turn?.end();
        }
    }
}

@ComponentDecorator()
export class Register<A extends IApp<A>> extends Screen<A, Transient<A>>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
	{
		super(app, destructor, element, html);        
	}
	
    public override async init(...args:any):Promise<void>
	{
        const elements = this._elements;

        this.set(elements);

        const transient = this._transient = new Transient(this._app, this, elements);

        await super.init();

        transient.keyView.register = this;
        transient.totpView.register = this;
        transient.loginView.register = this;
    }

    public override async ready():Promise<void>
    {
        await super.ready();

        await this._transient.ready();
    }

    public async gotoNextScreen():Promise<void>
    {
        return await this._transient.gotoNextScreen();
    }

    public async register(key:string, totp:totp | emptystring, totpSecret:totpsecret | emptystring, progressor:IProgressor<A, {status:RegisterLoginStatus, details:string}>, options?:{rounds?:number, iterations?:number, memory?:number}):Promise<boolean | IAborted | IError>
    {
        return await this._transient.register(key, totp, totpSecret, progressor, options);
    }

    public get keyView():KeyView<A>
    {
        return this._transient.keyView;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
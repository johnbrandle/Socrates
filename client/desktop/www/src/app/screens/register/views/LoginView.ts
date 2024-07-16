import type { IApp } from "../../../IApp.ts";
import { View } from "../../../../library/components/view/View.ts";
import html from './LoginView.html';
import { Register } from "../Register.ts";
import { ComponentDecorator } from "../../../../library/decorators/ComponentDecorator.ts";
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor.ts";
import { EventListenerAssistant } from "../../../../library/assistants/EventListenerAssistant.ts";
import type { Turn } from "../../../../../../../../shared/src/library/basic/Turner.ts";

class Elements
{
    keyTextDiv!:HTMLDivElement;
    loginButton!:HTMLButtonElement;
}

@ComponentDecorator()
export class LoginView<A extends IApp<A>> extends View<A>
{
    public register!:Register<A>;

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
    }

    public override async ready():Promise<void>
    {
        await super.ready();

        this._eventListenerAssistant.subscribe(this._elements.loginButton, 'click', this.#onLoginButtonClicked);
    }

    public override async onShow():Promise<void>
    {
        this._elements.keyTextDiv.textContent = this.register.keyView.key;
    }

    #onLoginButtonClicked = async ():Promise<void> =>
    {
        let turn:Turn<A> | undefined;

        try
        {
            //get the abortable helper
            const _ = this.abortableHelper.throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
            _.check(await this.register.gotoNextScreen());
        }
        catch (error)
        {
            this._app.warn(error, 'failed to go to next screen', [], {names:[LoginView, this.#onLoginButtonClicked]});
        }
        finally
        {
            turn?.end();
        }
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
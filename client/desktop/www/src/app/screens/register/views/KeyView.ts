import type { IApp } from "../../../IApp.ts";
import { CenteredTextHelper } from "../../../helpers/CenteredTextHelper.ts";
import { View } from "../../../../library/components/view/View.ts";
import html from './KeyView.html';
import { Register } from "../Register.ts";
import { ComponentDecorator } from "../../../../library/decorators/ComponentDecorator.ts";
import { GlobalEvent } from "../../../../library/managers/GlobalListenerManager.ts";
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor.ts";
import { EventListenerAssistant } from "../../../../library/assistants/EventListenerAssistant.ts";
import { PasswordHelper, PasswordType } from "../../../helpers/PasswordHelper.ts";
import { ErrorJSONObject } from "../../../../../../../../shared/src/app/json/ErrorJSONObject.ts";
import type { RegisterLoginStatus } from "../../../managers/UserManager.ts";
import { type uint } from "../../../../../../../../shared/src/library/utils/IntegerUtil.ts";
import { Progressor } from "../../../../../../../../shared/src/library/progress/Progressor.ts";
import type { IError } from "../../../../../../../../shared/src/library/error/IError.ts";
import { type IAborted } from "../../../../../../../../shared/src/library/abort/IAborted.ts";
import type { Turn } from "../../../../../../../../shared/src/library/basic/Turner.ts";

class Elements
{
    keyTextField!:HTMLInputElement;
    optionsButton!:HTMLButtonElement;
    refreshButton!:HTMLButtonElement;
    
    optionsPanel!:HTMLDivElement;
    keyType1Button!:HTMLButtonElement;
    keyType2Button!:HTMLButtonElement;
    keyType3Button!:HTMLButtonElement;
    keyResistanceRange!:HTMLInputElement;
    keyEntropy!:HTMLElement;
    keyRoundsSelect!:HTMLSelectElement;
    keyIterationsSelect!:HTMLSelectElement;
    keyMemorySelect!:HTMLSelectElement;
    keyTimeToCrack!:HTMLElement;

    termsCheckbox!:HTMLInputElement;
    continueButton!:HTMLInputElement;
}

@ComponentDecorator()
export class KeyView<A extends IApp<A>> extends View<A>
{
    private _centeredTextHelper!:CenteredTextHelper<A>;
    private _eventListenerAssistant!:EventListenerAssistant<A>;

    public register!:Register<A>;

    private _passwordHelper!:PasswordHelper<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement)
    {
        super(app, destructor, element, html);
    }

    public override async init(...args:any):Promise<void>
	{        
        await super.init();
        
        const elements = this._elements;

        this.set(elements);

        const app = this._app;

        this._passwordHelper = new PasswordHelper<A>(this._app);
        this._centeredTextHelper = new CenteredTextHelper(app, elements.keyTextField);
        this._eventListenerAssistant = new EventListenerAssistant(app, this);
    }

    public override async ready():Promise<void>
    {
        await super.ready();

        const elements = this._elements;

        //init the options panel open/close functionality
        this._eventListenerAssistant.subscribe(elements.optionsButton, 'click', this.#onOptionsButtonClicked);
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Click, (event:MouseEvent) => this.onClickListened(event));

        //init toggle password type functionality in options panel
        this._eventListenerAssistant.subscribe(elements.keyResistanceRange, 'change', this.#onKeyResistanceRangeChanged);
        this._eventListenerAssistant.subscribe(elements.keyType1Button, 'click', this.#onKeyType1ButtonClicked);
        this._eventListenerAssistant.subscribe(elements.keyType2Button, 'click', this.#onKeyType2ButtonClicked);
        this._eventListenerAssistant.subscribe(elements.keyType3Button, 'click', this.#onKeyType3ButtonClicked);

        this._eventListenerAssistant.subscribe(elements.keyRoundsSelect, 'change', this.#onKeyRoundsSelectChanged);
        this._eventListenerAssistant.subscribe(elements.keyIterationsSelect, 'change', this.#onKeyIterationsSelectChanged);
        this._eventListenerAssistant.subscribe(elements.keyMemorySelect, 'change', this.#onKeyMemorySelectChanged);

        //refresh button spin functionality
        this._eventListenerAssistant.subscribe(elements.refreshButton, 'click', this.#onRefreshButtonClicked);

        //continue button functionality
        this._eventListenerAssistant.subscribe(elements.continueButton, 'click', this.#onContinueButtonClicked);
    }

    public override async onShow():Promise<void>
    {
        await this.#updateKey();
    }

    public override async onResize():Promise<void>
    {
        const elements = this._elements;
        this._centeredTextHelper.update(elements.refreshButton.offsetWidth + elements.optionsButton.offsetWidth);
    }

    #_id:number = 0;
    async #updateKey(options?:{turn?:Turn<A>}):Promise<true | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            //check if we are aborted
            const _ = this.abortableHelper.throwIfAborted();

            //get the turn
            turn = _.value(await this.getTurn(options?.turn));
            
            const elements = this._elements;

            let key:string;
            const passwordAssistant = this._passwordHelper;
            switch (this.selectedKeyType)
            {
                case 1:
                {
                    switch (this.selectedKeyResistance)
                    {
                        case 1:
                            key = passwordAssistant.generateKeyPassword(14); //80
                            break;
                        case 2:
                            key = passwordAssistant.generateKeyPassword(15); //85
                            break;
                        case 3:
                            key = passwordAssistant.generateKeyPassword(this._app.integerUtil.generate(16 as uint, 26 as uint)); //90-130
                            break;
                    } 
                    break;
                }
                case 2:
                {
                    switch (this.selectedKeyResistance)
                    {
                        case 1: 
                            key = await passwordAssistant.generateWordPassword(6, false); //77
                            break;
                        case 2:
                            key = await passwordAssistant.generateWordPassword(6, true); //83
                            break;
                        case 3:
                            key = await passwordAssistant.generateWordPassword(7, this._app.integerUtil.generate(0 as uint, 1 as uint) === 0 ? false : true); //90-96
                            break;
                    } 
                    break;
                }
                case 3: 
                    switch (this.selectedKeyResistance)
                    {
                        case 1:
                            key = passwordAssistant.generateCharPassword(13); //78
                            break;
                        case 2:
                            key = passwordAssistant.generateCharPassword(14); //84
                            break;
                        case 3:
                            key = passwordAssistant.generateCharPassword(this._app.integerUtil.generate(15 as uint, 32 as uint)); //90-193
                            break;
                    } 
                    break;
                default:
                    throw this._app.throw('invalid selectedKeyType', []);
            }

            const type = {1:PasswordType.Key, 2:PasswordType.Word, 3:PasswordType.Char}[this.selectedKeyType];
            const entropy = _.value(await passwordAssistant.calculateEntropy(key!, type));

            elements.keyTextField.value = key!;
            elements.keyEntropy.innerText = Math.floor(entropy!).toString();
            elements.keyTimeToCrack.innerText = 'Calculating...';

            const id = ++this.#_id;

            //wait a bit before calculating the time to crack as it's slow and it is called early
            this._app.promiseUtil.wait(250).then(async () => 
            {
                if (_.aborted() !== undefined || id !== this.#_id) return;

                passwordAssistant.estimateTimeToCrack(entropy, {rounds:this._rounds, iterations:this._iterations, memory:this._memory}).then((time:string) => 
                {
                    if (_.aborted() !== undefined || id !== this.#_id) return;
    
                    elements.keyTimeToCrack.innerText = time;
                });
            });
            
            this._centeredTextHelper.update(elements.refreshButton.offsetWidth + elements.optionsButton.offsetWidth);

            return _.value(true);
        }
        catch (error)
        {
            return this._app.warn(error, 'An error occurred while attempting to update the key.', [], {names:[KeyView, this.#updateKey]});
        }
        finally
        {
            if (options?.turn === undefined) turn?.end();
        }
    }

    public onClickListened(event:MouseEvent):void
    {
        const elements = this._elements;
        const target = event.target as Node;

        if (elements.optionsButton.contains(target) || elements.optionsPanel.contains(target) || elements.refreshButton.contains(target)) return;
        
        elements.optionsPanel.classList.remove('open');  
    }

    #onOptionsButtonClicked = () => void this._elements.optionsPanel.classList.toggle('open');
    #onKeyResistanceRangeChanged = async () => this.abortableHelper.check(await this.#updateKey());
    
    #onKeyType1ButtonClicked = () => this.#onSetActiveButton(this._elements.keyType1Button);
    #onKeyType2ButtonClicked = () => this.#onSetActiveButton(this._elements.keyType2Button);
    #onKeyType3ButtonClicked = () => this.#onSetActiveButton(this._elements.keyType3Button);

    #onSetActiveButton = async (activeButton:HTMLButtonElement):Promise<void> =>
    {
        let turn:Turn<A> | undefined;

        try
        {
            //get the abortable helper
            const _ = this.abortableHelper.throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());

            const elements = this._elements;
            const buttons = [elements.keyType1Button, elements.keyType2Button, elements.keyType3Button];
                
            buttons.forEach((button:HTMLButtonElement) => 
            {
                if (activeButton === button) button.classList.add('active');
                else button.classList.remove('active');
            });

            _.check(await this.#updateKey({turn}));
        }
        catch (error)
        {
            this._app.warn(error, 'An error occurred while attempting to set the active button.', [], {names:[KeyView, this.#onSetActiveButton]});
        }
        finally
        {
            turn?.end();
        }
    }

    private _rounds?:number;
    public get rounds() { return this._rounds; }
    #onKeyRoundsSelectChanged = () => 
    {
        this._rounds = parseInt(this._elements.keyRoundsSelect.value);

        this.#updateKey();
    }

    private _iterations?:number;
    public get iterations() { return this._iterations; }
    #onKeyIterationsSelectChanged = () => 
    {
        this._iterations = parseInt(this._elements.keyIterationsSelect.value);

        this.#updateKey();
    }

    private _memory?:number;
    public get memory() { return this._memory; }
    #onKeyMemorySelectChanged = () => 
    {
        this._memory = parseInt(this._elements.keyMemorySelect.value);

        this.#updateKey();
    }

    #onRefreshButtonClicked = async ():Promise<void> => 
    {
        let turn:Turn<A> | undefined;

        try
        {
            //get the abortable helper
            const _ = this.abortableHelper.throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
            const elements = this._elements;
            elements.refreshButton.firstElementChild!.classList.add('spin-animation');

            _.check(await this.#updateKey({turn}));
            _.check(await this._app.promiseUtil.wait(150));
            
            elements.refreshButton.firstElementChild!.classList.remove('spin-animation');
        }
        catch (error)
        {
            this._app.warn(error, 'An error occurred while attempting to refresh the key.', [], {names:[KeyView, this.#onRefreshButtonClicked]});
        }
        finally
        {
            turn?.end();
        }
    }
    
    #onContinueButtonClicked = async ():Promise<void> => 
    {
        //get the abortable helper
        const _ = this.abortableHelper.throwIfAborted();

        let turn:Turn<A> | undefined;

        try
        {
            //throw if we are aborted
            _.throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
            if (this._elements.termsCheckbox.checked !== true) return _.check(await this._app.dialogUtil.error(this, {title:'Oops!', html:'In order to proceed you must agree to our Terms of Service.'}));
            
            const progressor = new Progressor<A, {status:RegisterLoginStatus, details:string}, ErrorJSONObject>(this._app, () => true, this);
            const success = _.value(await this.register.register(this.key, '', '', progressor, {rounds:this._rounds, iterations:this._iterations, memory:this._memory}));

            if (success !== true) return;

            _.check(await this.goto(this.viewer!.views[this.index + 2]));
        }
        catch (e)
        {
            this._app.warn(e, 'An error occurred while attempting to continue.', [], {names:[KeyView, this.#onContinueButtonClicked]});

            //we need to generate a new key, or they could have issues trying again
            if (_.aborted() === undefined) await this.#updateKey({turn});
        }
        finally
        {
            turn?.end();
        }
    }

    public get selectedKeyType()
    {
        const elements = this._elements;
        const buttons = [elements.keyType1Button, elements.keyType2Button, elements.keyType3Button];
        
        for (let i = buttons.length; i--;)
        {
            if (!buttons[i].classList.contains('active')) continue;

            return i + 1;
        }

        return 0;
    }
    public get key() { return this._elements.keyTextField.value; }
    public get selectedKeyResistance() { return parseInt(this._elements.keyResistanceRange.value); }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
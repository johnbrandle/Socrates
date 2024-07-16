/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import { EventListenerAssistant } from "./EventListenerAssistant";

export class ButtonGroupAssistant<A extends IBaseApp<A>> extends DestructableEntity<A> 
{
    private _buttons:HTMLButtonElement[];
    private _onButtonClick:(button:HTMLButtonElement, index:number) => void;

    private _eventListenerAssitant!:EventListenerAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, buttons:HTMLButtonElement[], onButtonClick:(button:HTMLButtonElement, index:number) => void)
    {
        super(app, destructor);

        this._buttons = buttons;
        this._onButtonClick = onButtonClick;

        this._eventListenerAssitant = new EventListenerAssistant(this._app, this);

        this.#initialize();
    }

    #initialize():void 
    {
        const buttons = this._buttons;
        const onButtonClick = this._onButtonClick;

        for (let i = buttons.length; i--;)
        {
            const button = buttons[i];

            this._eventListenerAssitant.subscribe(button, 'click', (event:MouseEvent) =>
            { 
                this.#toggleButton(button); 
                onButtonClick(button, i);
            });
        }
    }

    #toggleButton(selectedButton:HTMLButtonElement):void 
    {
        for (const button of this._buttons)
        {
            if (button === selectedButton) 
            {
                button.classList.remove('btn-outline-secondary');
                button.classList.add('btn-secondary');
                continue;
            } 
            
            button.classList.remove('btn-secondary');
            button.classList.add('btn-outline-secondary');
        }
    }
}

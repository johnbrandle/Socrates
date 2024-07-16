/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { EventListenerAssistant } from "../../library/assistants/EventListenerAssistant.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { ISignal } from "../../../../../../shared/src/library/signal/ISignal.ts";
import { Signal } from "../../../../../../shared/src/library/signal/Signal.ts";
import type { IApp } from "../IApp.ts";

type InputElement = HTMLInputElement | HTMLTextAreaElement;

export class MaskedTextAssistant<A extends IApp<A>> extends DestructableEntity<A>
{
    private _input:WeakRef<InputElement>;
    private _delay:number;
    private _maskTimeout:number | undefined;
    private _text:string;
    private _maskingEnabled:boolean;
    private _storedCursorPositionStart:number | undefined;
    private _storedCursorPositionEnd:number | undefined;
    private _isMasked:boolean;

    private _eventListenerAssistant:EventListenerAssistant<A>;

    public readonly onUpdateSignal:ISignal<[]> = new Signal<[]>(this);
    
    constructor(app:A, destructor:IDestructor<A>, input:InputElement)
    {
        super(app, destructor);

        this._input = new WeakRef(input);
        this._delay = 2500;
        this._text = '';
        this._maskingEnabled = true;
        this._isMasked = false;

        let maskNextImmediatly = false;

        this._eventListenerAssistant = new EventListenerAssistant(app, this);
        this._eventListenerAssistant.subscribe(input, "input", () => { this.#handleInteraction(maskNextImmediatly); maskNextImmediatly = false; });
        this._eventListenerAssistant.subscribe(input, "keydown", () => this.#handleInteraction());
        this._eventListenerAssistant.subscribe(input, "click", () => 
        {
            const input = this._input.deref()!;

            this.#storeCursorPosition();
            input.value = this._text;
            this.#restoreCursorPosition();
            this._isMasked = false;
            this.#addTimeout();
            this.onUpdateSignal.dispatch();
        });
        this._eventListenerAssistant.subscribe(input, "paste", () => //called  too early, so set a flag
        {
            const input = this._input.deref()!;

            this._text = '';
            input.value = '';
            maskNextImmediatly = true;
        });
    }

    #updateInputValue(value: string)
    {
        const input = this._input.deref();
        if (!input) return;

        input.value = value;
        this.#restoreCursorPosition();
        this.onUpdateSignal.dispatch();
    }

    #storeCursorPosition()
    {
        const input = this._input.deref();
        if (!input) return;

        this._storedCursorPositionStart = input.selectionStart ?? undefined;
        this._storedCursorPositionEnd = input.selectionEnd ?? undefined;
    }

    #restoreCursorPosition()
    {
        if (this._storedCursorPositionStart === undefined) return;
        const input = this._input.deref();
        if (!input) return;
        
        input.setSelectionRange(this._storedCursorPositionStart, this._storedCursorPositionEnd ?? this._storedCursorPositionStart);
    }

    #addTimeout()
    {
        this._maskTimeout = window.setTimeout(() =>
        {
            if (!this._maskingEnabled) return;

            this.maskText();
        }, this._delay);
    }

    #handleInteraction(hideImmediatly:boolean=false)
    {
        this.onUpdateSignal.dispatch();

        if (!this._maskingEnabled) return;

        if (this._maskTimeout !== undefined) window.clearTimeout(this._maskTimeout);
        
        this.unmaskText();
        
        if (hideImmediatly)
        {
            this.maskText();
            return;
        }

        this.#addTimeout();
    }

    public unmaskText():void
    {
        if (!this._isMasked) return;
        this._isMasked = false;

        this.#storeCursorPosition();
        this.#updateInputValue(this._text);
    }

    public maskText():void
    {
        if (this._isMasked) return;
        const input = this._input.deref();
        if (!input) return;

        let result = '';
        let chars = this._text = input.value;
        for (let i = chars.length; i--;) result += '*';
        
        this._isMasked = true;

        this.#storeCursorPosition();
        this.#updateInputValue(result);
    }

    public enableMasking()
    {
        this._maskingEnabled = true;
        this.maskText();
    }

    public disableMasking()
    {
        this.unmaskText();
        this._maskingEnabled = false;
    }

    public get maskingEnabled() { return this._maskingEnabled; }
    public get text() { return this._text; }
}

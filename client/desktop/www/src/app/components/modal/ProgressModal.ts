/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Component } from '../../../library/components/Component.ts';
import type { IApp } from '../../IApp.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import html from './ProgressModal.html';
import bootstrap from 'bootstrap';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import type { IAbortable } from '../../../../../../../shared/src/library/abort/IAbortable.ts';
import { ResolvePromise } from '../../../../../../../shared/src/library/promise/ResolvePromise.ts';
import { AbortController } from '../../../../../../../shared/src/library/abort/AbortController.ts';
import type { IAbortController } from '../../../../../../../shared/src/library/abort/IAbortController.ts';

class Elements 
{
    modal!:HTMLElement;
    progressBar!:HTMLElement;
    title!:HTMLElement;
    status!:HTMLElement;
    details!:HTMLDetailsElement;
    detailsTextArea!:HTMLTextAreaElement;
    cancelButton!:HTMLButtonElement;
    continueButton!:HTMLButtonElement;
}

@ComponentDecorator()
export class ProgressModal<A extends IApp<A>> extends Component<A> 
{
    /**
     * The modal object.
     * @type {any}
     * @private
     */
    private _modal:any;

    private _abortController:IAbortController<A> | undefined;
    private _onHiddenPromise:ResolvePromise<void> | undefined;

    /**
     * Creates an instance of ProgressModal.
     * @param {IApp} app - The application object.
     * @param {HTMLElement} element - The HTML element of the modal.
     */
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html); 
    }

    /**
     * Initializes the modal.
     * @param {...any} args - The arguments to initialize the modal.
     * @returns {Promise<{ (): void } | void>} - A promise that resolves when the modal is initialized.
     * @override
     */
    public override async init(...args:any):Promise<void>
    {
        let promise = super.init();

        const elements = this._elements;

        this.set(elements);

        this._modal = new bootstrap.Modal(elements.modal);

        elements.continueButton.onclick = () => { this.hide(true); };
        elements.cancelButton.onclick = () => 
        {
            this._abortController?.abort('user clicked cancel button'); 
        };

        elements.modal.addEventListener('hidden.bs.modal', () => 
        {
            this.reset();

            if (this._abortController === undefined) return;

            this._abortController.onAbortedSignal.unsubscribe(this.onAbortableAborted);
            this._abortController = undefined;

            const onHiddenPromise = this._onHiddenPromise!;
            this._onHiddenPromise = undefined;
            onHiddenPromise.resolve();
        });

        this.reset();

        return promise;
    }

    /**
     * Resets the modal.
     */
    public reset()
    {
        this.title = 'Please wait...'; 
        this.status = '';
        this.progress = 0;

        const elements = this._elements;

        elements.detailsTextArea.value = '';
        
        elements.cancelButton.disabled = false;

        elements.cancelButton.style.display = 'none';
        elements.continueButton.style.display = 'none';
    }

    /**
     * Shows the modal.
     */
    public show(abortable:IAbortable, options?:{cancelable?:boolean}):IAbortable
    {
        if (this._abortController !== undefined) this._app.throw('show called while already showing', [], {correctable:true});

        const abortController = new AbortController(this._app, abortable);

        if (abortable.aborted === true) return abortController;

        this._onHiddenPromise = new ResolvePromise<void>();

        this._abortController = abortController;
        this._abortController.onAbortedSignal.subscribe(this, this.onAbortableAborted, {once:true});

        this.progress = 0;

        if (options?.cancelable === true) this._elements.cancelButton.style.display = 'block';

        this._modal.show();

        return abortController;
    }

    private onAbortableAborted = () =>
    {
        this._abortController = undefined;
        this._modal.hide();
    }

    /**
     * Hides the modal.
     * @param {boolean} [force=false] - Whether to force hide the modal.
     * @returns {boolean} - True if the modal is hidden, false otherwise.
     */
    public hide():[boolean, Promise<void>];
    public hide(force:true):Promise<void>;
    public hide(force:boolean=false):[boolean, Promise<void>] | Promise<void>
    {
        if (this._abortController === undefined) return force === true ? Promise.resolve() : [true, Promise.resolve()];

        const elements = this._elements;

        elements.cancelButton.disabled = true;
        
        if (elements.details.open && force !== true) //if details is open and force is not true, don't hide. why? because the user might want to see the details.
        {
            elements.cancelButton.style.display = 'none';
            elements.continueButton.style.display = 'block';
            return [false, this._onHiddenPromise!];
        }

        this._modal.hide();

        return force === true ? this._onHiddenPromise! : [true, this._onHiddenPromise!];
    }

    /**
     * Sets the title of the modal.
     * @param {string} title - The title of the modal.
     */
    public set title(title:string)
    {
        this._elements.title.textContent = title;
    }

    /**
     * Sets the status of the modal.
     * @param {string} status - The status of the modal.
     */
    public set status(status:string)
    {
        this._elements.status.textContent = status;
    }

    /**
     * Appends details to the modal.
     * @param {string} details - The details to append.
     * @param {boolean} [replaceLastLine=false] - Whether to replace the last line of the details.
     */
    public appendDetail(details:string, replaceLastLine:boolean=false)
    {
        let detailsTextArea = this._elements.detailsTextArea;

        let value = detailsTextArea.value;
        if (replaceLastLine)
        {
            let parts = value.split('\n');
            parts.pop();
            value = parts.join('\n');
        }

        detailsTextArea.value = !value ? details : value + '\n' + details;
    }

    /**
     * Sets the progress of the modal.
     * @param {number} progress - The progress of the modal.
     */
    public set progress(progress:number)
    {
        const elements = this._elements;

        elements.progressBar.style.width = Math.ceil(progress * 100) + '%';
        elements.progressBar.setAttribute('aria-valuenow', progress.toString());
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
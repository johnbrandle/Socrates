/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import bootstrap from 'bootstrap';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IAbortable } from '../../../../../../shared/src/library/abort/IAbortable.ts';
import { ResolvePromise } from '../../../../../../shared/src/library/promise/ResolvePromise.ts';
import type { IBaseApp } from '../../library/IBaseApp.ts';

@SealedDecorator()
export class DialogUtil<A extends IBaseApp<A>> 
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    private _showing:boolean = false;

    /**
     * Displays an error dialog with the provided title and message.
     */
    public async error(abortable:IAbortable, options:{title?:string, html?:string, detailsTitle?:string, detailsHTML?:string, devError?:any}):Promise<false> 
    {
        const {title, html, detailsTitle, detailsHTML, devError} = options;

        //if there is a dev error, log it, but we will likely do something more with this in the future
        if (devError !== undefined) this._app.consoleUtil.error(devError);
        
        //if the dialog is already showing, or the abortable has been aborted, return false
        if (this._showing === true || abortable.aborted === true) return false;

        //mark the dialog as showing
        this._showing = true;

        const promise = new ResolvePromise<false>();

        const createModal = (id:string, title:string, content:string, iconName:string, footer:string="") => `
            <div class="modal fade" tabindex="-1" id="${id}">
            <div class="modal-dialog">
                <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                    <i class="bi bi-${iconName} text-warning me-2"></i>
                    ${title ?? 'Notice'}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">${content}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ""}
                </div>
            </div>
            </div>
        `;

        const uid = this._app.uidUtil.generate();
        const modalHtml = createModal(uid,
            title ?? "Notice",
            html ?? "Something went wrong. Please try again.",
            "exclamation-triangle",
            detailsHTML
            ? `<a href="" name="details">See details?</a>`
            : ""
        );

        document.body.insertAdjacentHTML("beforeend", modalHtml);
        const errorModalElement = document.getElementById(uid)!;
        const errorModal = new bootstrap.Modal(errorModalElement);

        let abortableListener = () => errorModal.hide();
        abortable.onAbortedSignal.subscribe(abortableListener, {once:true, weak:false});

        //if there are details and the user opens clicks it, it will close the existing modal and open a new one with the details. so use
        //resolvePromise to determine if the promise should be resolved when the first modal is closed (true if they did not click on details, false if they did)
        let resolvePromise = true;
        
        if (detailsHTML)
        {
            errorModalElement.querySelector('[name="details"]')!.addEventListener('click', event => 
            {
                event.stopImmediatePropagation();
                event.preventDefault();

                resolvePromise = false;
                errorModal.hide();

                setTimeout(async () => 
                {
                    //handle the case where the abortable aborted while waiting for the timeout
                    if (abortable.aborted === true)
                    {
                        abortable.onAbortedSignal.unsubscribe(abortableListener);
                        
                        this._showing = false;
                        promise.resolve(false);
                        return;
                    }

                    const uid = this._app.uidUtil.generate();
                    const detailsModalHtml = createModal(uid, detailsTitle || '', detailsHTML, "info");
                    document.body.insertAdjacentHTML("beforeend", detailsModalHtml);
                    const detailsModalElement = document.getElementById(uid)!;
                    const detailsModal = new bootstrap.Modal(detailsModalElement);

                    abortableListener = () => detailsModal.hide();
                    abortable.onAbortedSignal.subscribe(abortableListener, {once:true, weak:false});
                    
                    detailsModalElement.addEventListener("hidden.bs.modal", () => 
                    {
                        if ((detailsModalElement.parentElement ?? undefined) === undefined) return;

                        detailsModalElement.remove();
                        abortable.onAbortedSignal.unsubscribe(abortableListener);

                        this._showing = false;
                        promise.resolve(false);
                    });

                    detailsModal.show();
                }, 500);
            });
        }

        errorModalElement.addEventListener("hidden.bs.modal", () => 
        {
            //it's possible that while the dialog was closing due to user action, the abortable was aborted, which might cause this to be called twice, so check before proceeding
            //if the abortable caused it, then the listener would already have been removed due to the 'once' option
            if ((errorModalElement.parentElement ?? undefined) === undefined) return;

            errorModalElement.remove();
            abortable.onAbortedSignal.unsubscribe(abortableListener);

            if (resolvePromise !== true) return;

            this._showing = false;
            promise.resolve(false);
        });

        errorModal.show();

        return promise;
    }

    /**
     * Displays an HTML dialog with the provided title and content.
     */
    public html(abortable:IAbortable, options:{title:string, html:string}):[Promise<void> | undefined, HTMLElement | undefined, {hide:Function} | undefined]
    {
        //if the dialog is already showing, or the abortable has been aborted, return undefined
        if (this._showing === true || abortable.aborted === true) return [undefined, undefined, undefined];
        
        this._showing = true;

        const {title, html} = options;

        const uid = this._app.uidUtil.generate();
        const modalHtml = 
        `
            <div class="modal fade" tabindex="-1" id="${uid}">
            <div class="modal-dialog">
                <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">${title || ''}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">${html}</div>
                </div>
            </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const htmlModalElement = document.getElementById(uid)!;
        const htmlModal = new bootstrap.Modal(htmlModalElement);

        const promise = new ResolvePromise<void>();

        const abortableListener = () => htmlModal.hide();    
        abortable.onAbortedSignal.subscribe(abortableListener, {once:true, weak:false});

        htmlModalElement.addEventListener('hidden.bs.modal', () => 
        {
            if ((htmlModalElement.parentElement ?? undefined) === undefined) return;
            
            htmlModalElement.remove();
            abortable.onAbortedSignal.unsubscribe(abortableListener);

            this._showing = false;
            promise.resolve();
        });

        htmlModal.show();

        return [promise, htmlModalElement, htmlModal];
    }

    /**
     * Displays a confirm dialog with the provided title and content.
     */
    public async confirm(abortable:IAbortable, options:{title?:string, html?:string, confirmText?:string, cancelText?:string}):Promise<boolean> 
    {
        if (this._showing === true || abortable.aborted === true) return false;
        
        this._showing = true;

        const {title, html, confirmText, cancelText} = options;

        const uid = this._app.uidUtil.generate();
        const modalHtml = `
        <div class="modal fade" tabindex="-1" id="${uid}">
            <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                <h5 class="modal-title">${title || ''}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">${html || ''}</div>
                <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" name="cancelButton">${cancelText ?? 'Cancel'}</button>
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal" name="confirmButton">${confirmText ?? 'Yes'}</button>
                </div>
            </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modalElement = document.getElementById(uid)!;
        const confirmModal = new bootstrap.Modal(modalElement);

        const promise = new ResolvePromise<boolean>(); 

        const abortableListener = () => confirmModal.hide(); 
        abortable.onAbortedSignal.subscribe(abortableListener, {once:true, weak:false});

        let resolve:boolean = false;

        modalElement.querySelector('[name="confirmButton"]')!.addEventListener('click', () => 
        {
            confirmModal.hide();
            
            resolve = true;
        });

        modalElement.querySelector('[name="cancelButton"]')!.addEventListener('click', () => 
        {
            confirmModal.hide();
            
            resolve = false;
        });

        modalElement.addEventListener('hidden.bs.modal', () => 
        {
            if ((modalElement.parentElement ?? undefined) === undefined) return;

            modalElement.remove();
            abortable.onAbortedSignal.unsubscribe(abortableListener);

            this._showing = false;
            promise.resolve(resolve);
        });

        confirmModal.show();
        
        return promise;
    }
}
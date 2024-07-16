/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator";
import { type IAbortable, IAbortableType } from "../../../../../../shared/src/library/abort/IAbortable";
import type { IWeakSignal } from "../../../../../../shared/src/library/signal/IWeakSIgnal";
import type { IApp } from "../../IApp";

@ImplementsDecorator(IAbortableType)
export class RemoteAbortController<R=any> implements IAbortable<R>
{    
    #_app:IApp;
    
    private _aborted = false;
    public get aborted():boolean { return this._aborted; }

    private _reason:string = '';
    public get reason():string { return this._reason; }

    public get result():R | undefined { return undefined; }

    public get signal():AbortSignal { return this.#_app.throw('not implemented', arguments); }

    public get onAbortedSignal():IWeakSignal<[IAbortable<R>, string, R | undefined]> { return this.#_app.throw('not implemented', arguments); }

    constructor(); //we don't actually use this overload. it is here for the web renderer process (see AppAPI.ts)
    constructor(main:IApp);
    constructor(...args:any[])
    {
        const [app] = args as [IApp];

        this.#_app = app;
    }

    public async abort(reason:string):Promise<void>
    {
        this._aborted = true;
        this._reason = reason;
    }

    public addAbortable(abortable:IAbortable):void
    {
        this.#_app.throw('not implemented', arguments);
    }
}
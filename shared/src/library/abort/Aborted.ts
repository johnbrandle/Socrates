/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IAbortableType, type IAbortable } from "./IAbortable";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IAborted } from "./IAborted";
import { IWeakSignal } from "../signal/IWeakSIgnal";
import { WeakSignal } from "../signal/WeakSignal";
import { IBaseApp } from "../IBaseApp";

/**
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(IAbortableType)
export class Aborted<R=any> implements IAborted<R>
{
    private _app:IBaseApp<any>;

    public get aborted():true { return true; }

    private _reason:string;
    public get reason():string { return this._reason; }

    private _result?:R;
    public get result():R | undefined { return this._result; }

    private readonly _abortController:AbortController = new AbortController();
    public get signal():AbortSignal { return this._abortController.signal; }

    private _onAbortedSignal:IWeakSignal<[IAbortable<R>, string, R | undefined]> | undefined;
    public get onAbortedSignal():IWeakSignal<[IAbortable<R>, string, R | undefined]> { return this._onAbortedSignal ?? (this._onAbortedSignal = new WeakSignal(this._app)); }

    constructor(app:IBaseApp<any>, reason:string, result?:R)
    {
        this._app = app;
        this._reason = reason;
        this._result = result;

        this._abortController.abort(reason);
    }

    public addAbortable(_abortable:IAbortable):void {}
}
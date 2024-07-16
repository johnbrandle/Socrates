/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "./IAbortable";
import { AbortableEntity } from "../entity/AbortableEntity";
import { IAbortControllerType, type IAbortController } from "./IAbortController";
import type { IBaseApp } from "../IBaseApp";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IAborted } from "./IAborted";

@ImplementsDecorator(IAbortControllerType)
export class AbortController<A extends IBaseApp<A>, R=any> extends AbortableEntity<A, R> implements IAbortController<A, R>
{
    /**
     * A function that determines whether a value should trigger an abort or not.
     * @param value The value to check.
     * @returns `false` if the value should not trigger an abort, otherwise returns a result of type `R`.
     */
    #_shouldAbortFunction?:(value?:any) => (false | string | [string, R]);

    /**
     * Creates a new instance of the AbortController class.
     * @param shouldAbortFunction Optional function that determines whether the controller should abort based on a given value.
     */
    constructor(app:A, abortables:IAbortable[] | IAbortable, shouldAbortFunction?:(value?:any) => (false | string | [string, R]));
    constructor(app:A, shouldAbortFunction?:(value?:any) => (false | string | [string, R]));
    constructor(app:A, ...args:any[])
    {
        if (app.typeUtil.isArray(args[0]) === true || app.typeUtil.is<AbortableEntity<A>>(args[0], AbortableEntity) === true)
        {
            const [abortables, shouldAbortFunction] = args as [IAbortable | IAbortable[], (value?:any) => (false | string)];

            super(app, abortables);

            this.#_shouldAbortFunction = shouldAbortFunction;
        } 
        else 
        {
            const [shouldAbortFunction] = args as [(value?:any) => (false | string)];

            super(app);

            this.#_shouldAbortFunction = shouldAbortFunction;
        }
    }

    /**
     * Checks if the provided value should trigger an abort.
     * @param value - The value to check.
     * @returns True if the value should trigger an abort, false otherwise.
     */
    public check(value?:any):boolean 
    { 
        if (this._aborted === true) return true;
        if (this.#_shouldAbortFunction === undefined) return false;

        try
        {
            const response = arguments.length > 0 ? this.#_shouldAbortFunction(value) : this.#_shouldAbortFunction();

            if (response === false) return this._aborted;

            if (this._app.typeUtil.isArray(response)) this._abort(response[0], response[1]);
            else this._abort(response, undefined);

            this.#_shouldAbortFunction = undefined;
        }
        catch (error)
        {
            this.warn(error);
        }

        return this._aborted; 
    }

    public abort(reason:string, result?:R):IAborted<R>
    {
        return this._abort(reason, result);
    }

    public override get aborted():boolean 
    { 
        if (this._aborted === true) return true;
        if (this.#_shouldAbortFunction === undefined) return this._aborted;

        try
        {
            const response = this.#_shouldAbortFunction();

            if (response === false) return this._aborted;

            if (this._app.typeUtil.isArray(response)) this._abort(response[0], response[1]);
            else this._abort(response, undefined);

            this.#_shouldAbortFunction = undefined;
        }
        catch (error)
        {
            this.warn(error);
        }

        return super.aborted;
    }
}
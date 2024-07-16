/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IDatableType, type IDatable } from "./IDatable";
import type { IAborted } from "../abort/IAborted";
import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IError } from "../error/IError";
import { IBaseApp } from "../IBaseApp";

@ImplementsDecorator(IDatableType)
export class Data<A extends IBaseApp<A>, T> implements IDatable<T>
{
    #_app:A;

    #_data:() => Promise<T | IAborted | IError>;

    constructor(app:A, data:() => Promise<T | IAborted | IError>)
    {
        this.#_app = app;
        this.#_data = data;
    }

    async get():Promise<T | IAborted | IError>
    {
        const app = this.#_app;

        try
        {
            const data = this.#_data;
 
            return app.extractOrRethrow(await data());
        }
        catch(error)
        {
            return app.warn(error, 'failed to get data', arguments, {names:[Data, Data.prototype.get]});
        }
    }
}
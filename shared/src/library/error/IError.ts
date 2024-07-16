/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IAborted } from "../abort/IAborted";

export const IErrorType = Symbol("IError");

export interface IError extends globalThis.Error
{
    get name():string;
    get message():string;
    get stack():string | undefined;
    get cause():unknown;
    
    get objects():any[];

    get correctable():boolean;

    get aborted():IAborted | undefined;

    get __stackTraceCaptured():boolean;
    set __stackTraceCaptured(value:boolean);
}
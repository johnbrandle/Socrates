/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export const ITransientableType = Symbol("ITransientable");

export interface ITransientable
{
    get isTransient():boolean;
    get html():string;
}
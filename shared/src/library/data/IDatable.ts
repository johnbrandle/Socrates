/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IError } from "../error/IError";
import type { IAborted } from "../abort/IAborted";

export const IDatableType = Symbol("IDatable");

export interface IDatable<T>
{
    get():Promise<T | IAborted | IError>;
}
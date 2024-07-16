/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { FailureCode } from "./FailureCode";

export const IFailureType = Symbol("IFailure");

export interface IFailure<V={code:FailureCode, details:string}>
{
    get value():V;
}
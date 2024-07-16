/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator.ts";
import { FailureCode } from "./FailureCode.ts";
import { IFailure, IFailureType } from "./IFailure.ts";

@ImplementsDecorator(IFailureType)
export class Failure<V={code:FailureCode, details:string}> implements IFailure<V>
{
    public readonly value:V;

    constructor(value:V)
    {
        this.value = value;
    }
}
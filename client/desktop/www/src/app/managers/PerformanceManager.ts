/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { PerformanceManager as SharedPerformanceManager } from "../../library/managers/PerformanceManager.ts";
import type { IApp } from "../IApp.ts";

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
export class PerformanceManager<A extends IApp<A>> extends SharedPerformanceManager<A>
{
    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";

export const ITranscodeManagerType = Symbol("ITranscodeManager");

export interface ITranscodeManager<A extends IBaseApp<A> = IBaseApp>
{
}
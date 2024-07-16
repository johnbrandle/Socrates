/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IEnvironment as ISharedEnvironment, IFrozenEnvironment as ISharedFrozenEnvironment } from "../library/IEnvironment";

export interface IFrozenEnvironment extends ISharedFrozenEnvironment
{
}

export interface IEnvironment extends ISharedEnvironment
{
    frozen:IFrozenEnvironment;
}
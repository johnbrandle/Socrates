/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { type IAbortable } from "./IAbortable";

export type IAborted<R=any> = IAbortable<R> &
{
    readonly aborted:true;
};
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IView } from './view/IView.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export const IScreenType = Symbol("IScreen");

export interface IScreen<A extends IBaseApp<A>> extends IView<A>
{
}
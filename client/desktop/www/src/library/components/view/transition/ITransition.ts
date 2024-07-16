/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from '../../../IBaseApp';
import type { IDestructable } from '../../../../../../../../shared/src/library/IDestructable';
import type { IView } from '../IView';
import type { ITransitionEffect } from './ITransitionEffect';

export const ITransitionType = Symbol("ITransition");

export interface ITransition<A extends IBaseApp<A>> extends IDestructable<A>
{
    goto(view:IView<A>, ...args:any):Promise<void>;

    get effect():ITransitionEffect<A>;
    get duration():number;
}
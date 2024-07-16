/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from '../../IBaseApp.ts';
import type { IView } from './IView.ts';
import type { ITransition } from './transition/ITransition.ts';

export const IViewerType = Symbol("IViewer");

export const OnCurrent = Symbol('OnCurrent'); //for observers @see IObservable and ObservableManager

export interface IViewer<A extends IBaseApp<A>, T extends ITransition<A>=ITransition<A>> extends IView<A> 
{
    contains(view:IView<A>):boolean;

    goto(view:IView<A> | number):Promise<void>;

    at(index:number):IView<A>;

    setCurrent(view:IView<A>):Promise<void>;
    set __current(view:IView<A>);

    get transition():T | undefined;
}
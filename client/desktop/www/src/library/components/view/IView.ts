/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IComponent } from '../IComponent.ts';
import type { IViewer } from './IViewer.ts';
import type { IBaseApp } from '../../IBaseApp.ts';
import type { TransitionState } from './transition/Transition.ts';

export const IViewType = Symbol("IView");

export const OnLoadState = Symbol('OnLoadState'); //for observers @see IObservable and ObservableManager

export interface IView<A extends IBaseApp<A>> extends IComponent<A> 
{
    load(show?:boolean):Promise<void>;
    unload():Promise<void>;
    get loaded():boolean;
    
    get first():IView<A> | undefined;
    get last():IView<A> | undefined;
    get next():IView<A> | undefined;
    get previous():IView<A> | undefined;
    get current():IView<A>;
    
    get route():string;
    get index():number;

    get parent():IView<A> | undefined;
    get viewer():IViewer<A> | undefined;
    get base():IView<A>;
    get root():IView<A>;
    
    get views():Array<IView<A>>;
       
    goto(view:IView<A>):Promise<void>;
    
    __onTransition(state:TransitionState):void;
}
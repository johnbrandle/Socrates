/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { NitState } from './Component.ts';
import type { IBaseApp } from '../IBaseApp.ts';
import type { IDestructable } from '../../../../../../shared/src/library/IDestructable.ts';
import type { IIdentifiable } from '../../../../../../shared/src/library/IIdentifiable.ts';
import type { INameable } from '../../../../../../shared/src/library/INameable.ts';
import type { ITransientable } from './ITransientable.ts';

export const IComponentType = Symbol("IComponent");

export const OnInitState = Symbol('OnInitState'); //for observers @see IObservable and ObservableManager

/**
 * Represents a component in the application.
 */
export interface IComponent<A extends IBaseApp<A>> extends IIdentifiable, INameable, ITransientable, IDestructable<A> 
{
    /**
     * First stage of component initialization process.
     * Prepares the HTML for the component. This is called before the HTML is added to the element.
     */
    pnit(...args:any):void;

    /**
     * Second stage of the component initialization process.
     * This is called after init has been called on all created child components.
     * @param args - Arguments to be passed to the initialization function.
     * @returns A promise that resolves with void.
     */
    init(...args:any):Promise<void>;

    /**
     * Fourth and final stage of the component initialization process.
     * This is called after init has been called on all create child and parent components.
     * Optional: return a function, and it will be called after all created components have finished all four stages of the initialization process.
     * @returns A promise that resolves with void or a function that resolves to a promise of void.
     */
    fnit(...args:any):Promise<void>;

    /**
     * Called once component has been initialized.
     * @returns A promise that resolves with void.
     */
    ready():Promise<void>;

    /**
     * Called once component has been initialized, and ready called. (ComponentFactory calls this)
     */
    __onReadyComplete():void 

    /**
     * Deinitializes the component.
     * @returns a promise resolving to a boolean indicating if the component has already been dnited (true if no, false if yes).
     * 
     * transient components have the option to partially dnit, so they can go through the init process again. 
     * this means dnit could be called once or twice on a transient component. either a full dnit, or a partial dnit followed by a pnit or a full dnit.
     */
    dnit(partial:boolean):Promise<boolean>;

    get __initializationState():NitState;
    set __initializationState(state:NitState);

    /**
     * Gets the fully qualified name of the component.
     * @returns The fully qualified name of the component.
     */
    get fullyQualifiedName():string;

    /**
     * Gets the base element of the component.
     * @returns The base element of the component.
     */
    get element():HTMLElement;

    /**
     * Indicates whether the component has been initialized.
     */
    get initialized():boolean;

    /**
     * Indicates whether the children components should be transparent to other components.
     * 
     * True if children should be transparent to other components (see Component find for an example of why this is useful)
     * Example: if this is a view or viewer, the children are not exclusive to it, and so should be transparent. 
     * However, if this is a button, only the button should have access to the children.
     */
    get transparent():boolean;

    /**
     * Determines whether the component should be automatically initialized or not.
     * If the 'data-init' attribute is set to 'manual', this property will return true.
     */
    get requiresManualInitialization():boolean;

    /**
     * For debugging purposes.
     */
    get debug():
    {
        show:() => void, 
        hide:() => void, 
        readonly showing:boolean,
        info:(id:string, value:string) => void;
    } | undefined;
}
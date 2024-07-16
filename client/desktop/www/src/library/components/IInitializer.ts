/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IComponent } from "./IComponent";

export const IInitializerType = Symbol("IInitializer");

export interface IInitializer
{
    vnit():void;
    init(_this:IInitializer, component:IComponent):Promise<void>;
    fnit(_this:IInitializer, component:IComponent):Promise<{():Promise<void>} | void>;

    /**
     * Determines whether this component is the initializer for the given component.
     * @param component - The component to check.
     */
    isInitializerForComponent(component:IComponent):boolean;
}
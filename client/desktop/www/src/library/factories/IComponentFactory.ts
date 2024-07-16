/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import type { IComponent } from "../components/IComponent";

export type ExcludeFirstThreeArgs<T extends any[]> = T extends [any, any, any, ...infer R] ? R : never;

export type CreateComponentOptions =
{
    name?:string;
    element?:HTMLElement;
    log?:boolean;
}

export const IComponentFactoryType = Symbol("IComponentFactory");

export interface IComponentFactory<A extends IBaseApp<A>>
{
    /**
     * Asynchronously creates and initializes components within a given element.
     * Returns an array of created components and a promise that resolves to the
     * initialized components.
     *
     * @static
     * @param {HTMLElement} element - The element containing the components to create and initialize.
     * @returns {Promise<[Array<IComponent>, Promise<Array<IComponent>>]>} A tuple containing the array
     *   of created components and a promise that resolves to the array of initialized components.
     */
    createComponents(destructor:IDestructor<A>, element:HTMLElement):[Array<IComponent<A>>, Promise<Array<IComponent<A>>>];
    
    /**
     * Creates a component with the provided class name, id, HTMLElement, constructor arguments, and initialization arguments.
     */
    createComponent(destructor:IDestructor<A>, className:string, constructorArgs:Array<any>, initArgs:Array<any>, fnitArgs:Array<any>, options:CreateComponentOptions):[IComponent, Promise<Array<IComponent<A>>>];
    createComponent<T extends new (...args:any[]) => IComponent<A>>(destructor:IDestructor<A>, className:T, constructorArgs:ExcludeFirstThreeArgs<ConstructorParameters<T>>, initArgs:Parameters<InstanceType<T>['init']>, fnitArgs:Array<any> | Parameters<InstanceType<T>['fnit']>, options:CreateComponentOptions):[InstanceType<T>, Promise<Array<IComponent<A>>>];
    createComponent<T extends new (...args:any[]) => IComponent<A>>(destructor:IDestructor<A>, className:string | T, constructorArgs:Array<any> | ExcludeFirstThreeArgs<ConstructorParameters<T>>, initArgs:Array<any> | Parameters<InstanceType<T>['init']>, fnitArgs:Array<any> | Parameters<InstanceType<T>['fnit']>, options:CreateComponentOptions):[InstanceType<T>, Promise<Array<IComponent<A>>>];

    /**
     * Loads a transient component by initializing its inner HTML and creating
     * any nested components within it. Then, it initializes it.
     */
    loadTransientComponent(component:IComponent<A>):Promise<void>;
}
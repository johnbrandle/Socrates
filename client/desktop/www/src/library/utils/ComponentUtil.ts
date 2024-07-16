/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { componentsByConstructorMap, componentsByPathMap } from "../decorators/ComponentDecorator";
import { type IComponent } from "../components/IComponent";
import type { IInitializer } from "../components/IInitializer.ts";
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";

export type ComponentRecord<A extends IBaseApp<A>> = 
{
    class:new (app:A, destructor:IDestructor<A>, element:HTMLElement, ...args:any[]) => IComponent<A>;
    element:HTMLElement;
    component?:IComponent<A>;
    parentComponentElement:HTMLElement | undefined;
    constructorArgs?:Array<any>;
    initArgs?:Array<any>;
    fnitArgs?:Array<any>;

    depth?:number;
    transient?:boolean;
    initializer?:IInitializer;
}

const noExlude:[boolean, boolean] = [false, false]; //micro optimization to avoid creating array objects
const exclude:[boolean, boolean] = [false, true]; //micro optimization to avoid creating array objects
const excludeChildrenOfComponents = (rootElement:Element, element:Element):[boolean, boolean] =>  //don't look into children of non-transparent components
{
    if (element === rootElement) return noExlude;

    const component = element?.component;
    if (component === undefined) return noExlude;
    if (component.transparent) return noExlude;

    return exclude;
}

const Processed = Symbol('ComponentProcessed');

@SealedDecorator()
export class ComponentUtil<A extends IBaseApp<A>> 
{    
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public readonly componentAttributeName:string = 'data-component';
    public readonly transientAttributeName:string = 'data-transient';

    public readonly initAttributeName:string = 'data-init';
    public readonly initAttributeManualValue:string = 'manual';

    /**
     * Retrieves the component path associated with a given component class.
     *
     * @param {new (...args: any[]) => IComponent} Class - The component class to find the associated component path for.
     * @returns {string} The component path associated with the given component class.
     */
    public getPath(Class:new (...args:any[]) => IComponent<any>):string
    {
        const path = componentsByConstructorMap.get(Class);
        if (path === undefined) this._app.throw('Class not found', [Class.name], {correctable:true});

        return path;
    }

    /**
     * Retrieves the component class associated with the given component path.
     *
     * @param {string} path - The path of the component class to retrieve.
     * @returns Function The component class associated with the given component path.
     */
    public getClass<A extends IBaseApp<A>>(path:string):new (...args:any[]) => IComponent<A>
    { 
        const Class = componentsByPathMap.get(path);
        if (Class === undefined) this._app.throw('Class not found', [path], {correctable:true});

        return Class as new (...args:any[]) => IComponent<A>;
    }

    /**
     * Finds one or more elements with the specified name within the given element and returns them as an array.
     * 
     * @template T
     * @param {string} name - The name of the elements to find.
     * @param {Element} [element] - The element to search within. If not provided, the current object's internal element is used.
     * @param {boolean} [optional=true] - A boolean flag indicating whether at least one element with the specified name is required to be found.
     * @returns {Array<T>} - An array of elements with the specified name.
     */
    public find = <T>(name:string, element:Element):Array<T> =>
    {
        return this._app.domUtil.find<T>(element, 'name', name, false, excludeChildrenOfComponents);
    }

    /**
     * Gets the value of a property from the current object or an element's attribute with the specified name.
     * 
     * @template T
     * @param {string} name - The name of the property/properties to get.
     * @param {Element} [element] - The element that the property belongs to, if applicable.
     * @returns {T | undefined} - The value of the property/properties, or undefined if the property was not found.
     */
    public get<T>(name:string, element:Element):T | undefined
    {
        return this._app.domUtil.find<T>(element, 'name', name, true, excludeChildrenOfComponents);
    }

    public getParent<T extends IComponent<any>>(component:IComponent<any>, Type:Symbol):T | undefined;
    public getParent<T extends (new (...args:any) => any)>(component:IComponent<any>, Type:T):InstanceType<T> | undefined;
    public getParent<T>(component:IComponent<any>, Type:Symbol | (new (...args:any) => any))
    {
        const app = this._app;

        let parentElement = component.element.parentElement ?? undefined;
        while (parentElement !== undefined)
        {
            if (app.typeUtil.is<T>(parentElement?.component, Type) === true) return parentElement.component;
            parentElement = parentElement.parentElement ?? undefined;
        }

        return undefined;
    }

    /**
     * Finds component elements within a given element and retrieves their
     * associated component classes. Returns an array of objects containing the component
     * element and its corresponding component class.
     *
     * @param {HTMLElement} element - The element containing the components to find.
     * @returns {Array<Record<string, any>>} An array of objects, each containing the component element and its corresponding component class.
     */
    public findElements<A extends IBaseApp<A>>(element:HTMLElement, component?:IComponent<any>):Array<ComponentRecord<A>> 
    {
        (element as any)[Processed] = true; //indicate that this element has been processed

        const stack:HTMLElement[] = [element]; 
        const processed:Set<HTMLElement> = new Set(); //indicates if children have been processed
        const componentRecords:Array<ComponentRecord<A>> = [];
        const parentMap:Map<HTMLElement, HTMLElement | undefined> = new Map();

        let relativePath = '';
        if (component !== undefined)
        {
            const fullyQualifiedClassName = this.getPath(component.constructor as new (...args:any[]) => IComponent<any>);
            const parts = fullyQualifiedClassName.split('/');
            parts.pop();
            relativePath = parts.join('/') + '/';
        }

        while (stack.length > 0) 
        {
            const currentElement = stack.pop() as HTMLElement;
    
            if (processed.has(currentElement))
            {
                let className = currentElement.getAttribute(this.componentAttributeName) ?? undefined;
                if (className === undefined || className.length === 0) this._app.throw('Component path missing on element', [currentElement.outerHTML], {correctable:true});
                if (className.startsWith('.') === true) className = relativePath + className.substring(2);
                
                (currentElement as any)[Processed] = true; //indicate that this element has been processed
                componentRecords.push({class:this.getClass(className), element:currentElement, component:undefined, parentComponentElement:parentMap.get(currentElement), constructorArgs:undefined, initArgs:undefined, fnitArgs:undefined});
                continue;
            }

            if ((currentElement as any)[Processed] !== true && currentElement.hasAttribute(this.componentAttributeName) === true) //if it is a component and has not been processed
            {
                processed.add(currentElement); //set processed true for current node
                stack.push(currentElement); //re-push the current node
            }

            let parentComponentElement = (currentElement.hasAttribute(this.componentAttributeName) ? currentElement : parentMap.get(currentElement)) || component?.element;

            const children = currentElement.children;
            for (let i = children.length; i--;) 
            {
                const child = children[i] as HTMLElement;
                if ((child as any)[Processed] !== true) 
                {
                    stack.push(child); //push child node
                    parentMap.set(child, parentComponentElement);
                }
            }
        }
    
        return componentRecords;
    }
    
    /**
     * Propagates through a tree of elements, invoking a handler function for each element that meets specific criteria.
     *
     * @param {Element} element - The root element of the tree to start propagating from.
     * @param {(...args: Array<any>) => any} handler - The function to be invoked for each relevant element.
     * @param {boolean} [bubble=false] - Optional. If true, the propagation also occurs through the parent elements.
     * @param {boolean} [immediateChildrenOnly=false] - Optional. If true, the propagation only occurs for the immediate children of the root element.
     * @param {boolean} [componentsMustBeInitialized=true] - Optional. If true, the handler function is only invoked for initialized components.
     * @returns {void}
     * @example
     * const rootNode = document.querySelector('#container');
     * const handler = (component) => 
     * {
     *   ConsoleUtil.log(`Component: ${component}`);
     *   return false; //stop propagation
     * };
     * const bubble = true;
     * const immediateChildrenOnly = false;
     *
     * this.propagate(rootNode, handler, bubble, immediateChildrenOnly);
     */
    public async propagate(element:Element, handler:(...args:any) => Promise<boolean | void> | boolean | void, bubble:boolean, immediateChildrenOnly:boolean, componentsMustBeInitialized=true):Promise<void> 
    {
        const parentNodesAndChildren:Array<Element> = []; //for bubbling

        if (bubble === true) 
        {
            let parentElement = element.parentElement ?? undefined;
            while (parentElement !== undefined && parentElement !== document.documentElement) 
            {
                parentNodesAndChildren.push(parentElement);
                parentElement = parentElement.parentElement ?? undefined;
            }
        }

        const handle = async(component:IComponent<any>):Promise<boolean> => 
        {
            if (componentsMustBeInitialized === true && component.initialized !== true) 
            {
                this._app.consoleUtil.warn(this.constructor, 'Component not initialized', component.constructor.name);
                return true; //stop propagation if component is not initialized
            }

            const result = handler(component); //let the dispatcher handle how children are notified
            const stopChildPropagation = ((result instanceof Promise) ? await result : result) ?? false;

            return stopChildPropagation;
        };

        const stack = Array.from(element.children);
        while (stack.length > 0) 
        {
            const currentNode = stack.pop() as Element;

            const children = currentNode.children;
            const component = currentNode.component;
            if (component === undefined) 
            {
                if (immediateChildrenOnly === true) continue; //node is not a component and we only want to process immediate children, so do not process this node's children

                //push child nodes to the stack to process later
                for (let i = children.length; i--;) stack.push(children[i]);
                
                continue;
            } 
            
            const stopChildPropagation = await handle(component);
            if (stopChildPropagation === true) continue;

            for (let i = children.length; i--;) stack.push(children[i]);  
        }

        if (bubble !== true) return;

        immediateChildrenOnly = true; //so we do not process the children of the parents
        for (let i = 0, length = parentNodesAndChildren.length; i < length; i++) 
        {
            const parentNode = parentNodesAndChildren[i];
            const component = parentNode.component;
            if (component === undefined) continue;
            
            await handle(component);
        }
    }

}

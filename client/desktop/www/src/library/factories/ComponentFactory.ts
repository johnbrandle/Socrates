/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { NitState } from "../components/Component";
import type { IComponent } from "../components/IComponent";
import type { IInitializer } from "../components/IInitializer";
import { IInitializerType } from "../components/IInitializer";
import type { IBaseApp } from "../IBaseApp";
import type { ComponentRecord } from "../utils/ComponentUtil";
import { type ExcludeFirstThreeArgs, type CreateComponentOptions, IComponentFactoryType } from "./IComponentFactory";
import type { IComponentFactory } from "./IComponentFactory";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator";

@ImplementsDecorator(IComponentFactoryType)
export class ComponentFactory<A extends IBaseApp<A>> extends DestructableEntity<A> implements IComponentFactory<A>
{    
    constructor(app:A, destructor:IDestructor<A>) 
    {
        super(app, destructor);
    }

    public createComponents = (destructor:IDestructor<A>, element:HTMLElement):[Array<IComponent<A>>, Promise<Array<IComponent<A>>>] => this.#createComponents(destructor, this._app.componentUtil.findElements(element, undefined), true);
    
    public createComponent(destructor:IDestructor<A>, className:string, constructorArgs:Array<any>, initArgs:Array<any>, fnitArgs:Array<any>, options:CreateComponentOptions):[IComponent<A>, Promise<Array<IComponent<A>>>];
    public createComponent<T extends new (...args:any[]) => IComponent<A>>(destructor:IDestructor<A>, className:T, constructorArgs:ExcludeFirstThreeArgs<ConstructorParameters<T>>, initArgs:Parameters<InstanceType<T>['init']>, fnitArgs:Array<any> | Parameters<InstanceType<T>['fnit']>, options:CreateComponentOptions):[InstanceType<T>, Promise<Array<IComponent<A>>>];
    public createComponent<T extends new (...args:any[]) => IComponent<A>>(destructor:IDestructor<A>, className:string | T, constructorArgs:Array<any> | ExcludeFirstThreeArgs<ConstructorParameters<T>>, initArgs:Array<any> | Parameters<InstanceType<T>['init']>, fnitArgs:Array<any> | Parameters<InstanceType<T>['fnit']>, options:CreateComponentOptions):[InstanceType<T>, Promise<Array<IComponent<A>>>]
    {
        const element = options.element ?? document.createElement('div');
        
        if (options.name !== undefined) element.setAttribute('name', options.name);
        
        let Class:new (app:A, destructor:IDestructor<A>, element:HTMLElement, ...args: any[]) => IComponent<A>;
        let fullyQualifiedClassName:string;

        if (className instanceof Function)
        {
            Class = className;
            fullyQualifiedClassName = this._app.componentUtil.getPath(Class);
        }
        else
        {
            Class = this._app.componentUtil.getClass(className);
            fullyQualifiedClassName = className;
        }

        element.setAttribute(this._app.componentUtil.componentAttributeName, fullyQualifiedClassName);
        
        const objects = [{class:Class, element:element, constructorArgs:constructorArgs, initArgs:initArgs, fnitArgs:fnitArgs, parentComponentElement:undefined}];
        const [components, promise] = this.#createComponents(destructor, objects, options.log);

        return [components[components.length - 1] as InstanceType<T>, promise];
    }

    #createComponents(destructor:IDestructor<A>, objects:Array<ComponentRecord<A>>, log:boolean=false):[Array<IComponent<A>>, Promise<Array<IComponent<A>>>]
    {
        let components:Array<IComponent<A>>;
        
        [objects, components] = this.#constructComponents(destructor, objects, log);

        const promise:Promise<Array<IComponent<A>>> = this.#initComponents(objects, log)
        .then((childDepthGroups) => this.#fnitComponents(childDepthGroups, log))
        .then((childDepthGroups) => this.#readyComponents(childDepthGroups, log)).then(() => components);
      
        return [components, promise];
    }

    /**
     * getCreationHandler creates a handler for creating components
     * in a depth-first search (DFS) order.
     *
     * The process is as follows:
     * 1. **Create Parent**: Instantiate the parent component based on the class definition.
     * 2. **Process Parent**: The `pnit` method of the parent component is invoked.
     * 3. **Recurse into Children**: If the parent component has children, these steps (1-2) are recursively repeated for each child.
     * 4. **Finalize Parent**: After all children of a parent have been processed, 
     *    the `vnit` method of the parent is invoked if it implements IInitializer.
     * 
     * Transient components do not go through the enitire process.
     * 
     * This dynamically discovers and inserts new nodes (components) while maintaining the correct post DFS order.
     *
     * ### Example:
     * 
     * Let's say we start with a simpler tree, but while processing, we discover some nodes (components)
     * that need to be inserted as children.
     * 
     * Initial Array: `[2, 1]`
     * 
     * The tree initially looks like this:
     * ```
     *     1
     *    /
     *   2
     * ```
     * 
     * When we process `2`, we discover it has two children: `3` and `4`.
     * Similarly, when we process `1`, we discover it has a new child `5`.
     * 
     * #### Step 1
     * - We start with `2`, and discover it has children `3` and `4`.
     * - Insert `3` and `4` before `2`.
     *   
     * Array after Step 1: `[3, 4, 2, 1]`
     * 
     *   1   [Before Step 1]
     *  /
     * 2
     * 
     *     1       [After Step 1]
     *    /
     *   2
     *  / \
     * 3   4
     * 
     * #### Step 2
     * - Process `3`, no children found.
     * - Finalize `3`
     * 
     * Array after Step 2: `[3, 4, 2, 1]`
     * 
     * #### Step 3
     * - Process `4`, no children found.
     * - Finalize `4`
     * 
     * Array after Step 3: `[3, 4, 2, 1]`
     * 
     * #### Step 4
     * - Now `2` can be finalized as its children `3` and `4` are finalized.
     * - Finalize `2`
     * 
     * Array after Step 4: `[3, 4, 2, 1]`
     * 
     * #### Step 5
     * - Process `1`, and discover it has a new child `5`.
     * - Insert `5` before `1`.
     *   
     * Array after Step 5: `[3, 4, 2, 5, 1]`
     * 
     *      1       [Before Step 5]
     *     / 
     *    2   
     *   / \
     *  3   4
     * 
     *       1     [After Step 5]
     *      / \
     *     2   5
     *    / \
     *   3   4
     * 
     * #### Step 6
     * - Process `5`, no children found.
     * - Finalize `5`
     * 
     * Array after Step 6: `[3, 4, 2, 5, 1]`
     * 
     * #### Step 7
     * - Now `1` can be finalized as its children `2` and `5` are finalized.
     * - Finalize `1`
     * 
     * Array after Step 7: `[3, 4, 2, 5, 1]`
     * 
     * In this example, we dynamically discovered and inserted new nodes while processing the tree.
     * Even though the tree is shallower, it demonstrates the idea of dynamic insertion while maintaining
     * the correct DFS order.
     * 
     * @param {Array<ComponentRecord>} objects - The array of ComponentRecords in post-DFS order.
     * @param {boolean} log - Whether to only log errors.
     * @returns {Array<IComponent>} - The array of constructed components in post-DFS order.
     */
    #constructComponents(destructor:IDestructor<A>, objects:Array<ComponentRecord<A>>, log:boolean):[Array<ComponentRecord<A>>, Array<IComponent<A>>]
    {
        const updatedObjects:Array<ComponentRecord<A>> = [];
        const dfsOrderedComponents:IComponent<A>[] = [];
        const app:A = this._app;

        const finalizeComponent = (component:IComponent<A>):void =>
        {
            if (app.typeUtil.is<IInitializer>(component, IInitializerType)) component.vnit();
        }

        let stack:Array<{objects:Array<ComponentRecord<A>>, index:number, parentObjectAwaitingFinalization:undefined} | {objects:undefined, index:number, parentObjectAwaitingFinalization:ComponentRecord<A>}> = [{objects:objects, index:0, parentObjectAwaitingFinalization:undefined}];
        while (stack.length > 0)
        {
            const next = stack.pop()!;
            
            if (next.parentObjectAwaitingFinalization !== undefined) //time to finalize the parent
            {
                const parentObject = next.parentObjectAwaitingFinalization;

                finalizeComponent(parentObject.component!);
                
                dfsOrderedComponents.push(parentObject.component!);
                updatedObjects.push(parentObject);
                continue;
            }

            //create the components if next index is 0 (meaning this is the first time the objects array has run through the queue loop)
            //components are created in bfs order, but we want to process them in dfs order after they have been created
            //we create them in bfs order because we need the parent, which is the destructor for the child
            if (next.index === 0)
            {
                for (let i = next.objects.length; i--;) //iterate backwards for bfs order
                {
                    const object = next.objects[i];
                    const element = object.element;
                    const Class = object.class;
                    const constructorArgs = object.constructorArgs ?? [];
                    const eachDestructor = object.parentComponentElement === undefined ? destructor : object.parentComponentElement.component!;
  
                    let component:IComponent<A>;
                    switch (constructorArgs.length) //because it's faster
                    {
                        case 0:
                            component = new Class(app, eachDestructor, element);
                            break;
                        case 1:
                            component = new Class(app, eachDestructor, element, constructorArgs[0]);
                            break;
                        case 2:
                            component = new Class(app, eachDestructor, element, constructorArgs[0], constructorArgs[1]);
                            break;
                        case 3:
                            component = new Class(app, eachDestructor, element, constructorArgs[0], constructorArgs[1], constructorArgs[2]);
                            break;
                        case 4:
                            component = new Class(app, eachDestructor, element, constructorArgs[0], constructorArgs[1], constructorArgs[2], constructorArgs[3]);
                            break;
                        case 5:
                            component = new Class(app, eachDestructor, element, constructorArgs[0], constructorArgs[1], constructorArgs[2], constructorArgs[3], constructorArgs[4]);
                            break;
                        case 6:
                            component = new Class(app, eachDestructor, element, constructorArgs[0], constructorArgs[1], constructorArgs[2], constructorArgs[3], constructorArgs[4], constructorArgs[5]);
                            break;
                        default:
                            component = new Class(app, eachDestructor, element, ...constructorArgs);
                    }

                    if (object.component !== undefined) this._app.throw('Component already exists', [], {correctable:true}); //this should never happen (if it happens you have an error in this algorithm)
                    object.component = component;  //set the component
                }
            }

            for (let i = next.index, length = next.objects.length; i < length; i++)
            {
                const object = next.objects[i];
                const element = object.element;
                const component = object.component!;
                
                object.transient = component.isTransient;

                if (object.transient === true) //transient components do not go through the entire process
                {
                    dfsOrderedComponents.push(component);
                    updatedObjects.push(object);
                    continue;
                }

                component.__initializationState = NitState.Pniting;
                component.pnit();
                component.__initializationState = NitState.Pnited;

                const innerObjects = this._app.componentUtil.findElements<A>(element, component);
                if (innerObjects.length > 0) //process children before finalizing the parent
                {              
                    //processed 3rd
                    if (i !== length - 1) stack.push({objects:next.objects, index:i + 1, parentObjectAwaitingFinalization:undefined}); //continue processing the rest of the objects. rather than slicing the objects array, we can just push it back onto the queue with the updated (current + 1) index
                    
                    //processed 2nd
                    stack.push({objects:undefined, index:0, parentObjectAwaitingFinalization:object}); //the parent needs to be finalized after all children have been processed
                    
                    //processed 1st
                    stack.push({objects:innerObjects, index:0, parentObjectAwaitingFinalization:undefined}); //process the children first (popped from the queue, so it will be processed first)
                    break;
                }
                else
                {
                    //if no children, finalize the component immediately.
                    finalizeComponent(component);

                    dfsOrderedComponents.push(component);
                    updatedObjects.push(object);
                }
            }
        }

        return [updatedObjects, dfsOrderedComponents];
    }
    
    /**
     * Initializes the components passed as an array of ComponentRecord objects.
     * Returns a Promise that resolves to a Map of components that require manual initialization and their corresponding initializers.
     * @param objects An array of ComponentRecord objects.
     * @param log A boolean indicating whether to only log errors.
     * @returns A Promise that resolves to a Map of components that require manual initialization and their corresponding initializers.
     */
    async #initComponents(objects:Array<ComponentRecord<A>>, log:boolean):Promise<Array<Array<ComponentRecord<A>>>> 
    {
        await this._app.promiseUtil.nextAnimationFrame(); //give them 1 frame to add the element to the dom

        //map to keep track of the depth of each HTML element
        const depthMap = new Map<HTMLElement, number>();
        const childDepthGroups:Array<Array<ComponentRecord<A>>> = [];  //nested array to hold components at each depth level
        
        //populate depthMap and childDepthGroups
        for (let i = objects.length; i--;) 
        {
            const object = objects[i];
            const element = object.element;
            const parentElement = element.parentElement ?? undefined;

            let depth = 0;
            if (parentElement === undefined) this._app.throw('Cannot find parent element for component', [object.component!.className], {correctable:true}); //the parent element should never be undefined at this point
            if (depthMap.has(parentElement)) depth = depthMap.get(parentElement)! + 1; //get the depth of the parent element and add 1
            object.depth = depth;
            depthMap.set(element, depth);

            if (childDepthGroups[depth] === undefined) childDepthGroups[depth] = []; //ensure there's an array to hold the group at this depth level
            
            childDepthGroups[depth].push(object); //add the component to the appropriate depth group
        }

        //initialize components by depth group, starting with the deepest
        for (let depth = childDepthGroups.length; depth--;) 
        {
            const sameLevelComponents = childDepthGroups[depth];
            const promises:Array<Promise<any>> = [];

            for (const object of sameLevelComponents) 
            {
                const component = object.component!;

                if (object.transient === true) continue;

                component.__initializationState = NitState.Initing;

                if (component.requiresManualInitialization === true) 
                {
                    const initializer:IInitializer = this.#findComponentInitializer(component);
                    object.initializer = initializer;
                    
                    promises.push(initializer.init(initializer, component).then(() => { component.__initializationState = NitState.Inited; }));
                    continue;
                }

                promises.push(component.init.apply(component, object.initArgs ?? []).then(() => { component.__initializationState = NitState.Inited; }));
            }

            //await all initializations at this depth level
            await Promise.all(promises);
        }

        if (log) this._app.consoleUtil.table(this.constructor, objects, {component:['className', 'name', 'id']});

        return childDepthGroups;
    }

    #findComponentInitializer(component:IComponent<A>):IInitializer
    {
        let initializer:IInitializer | undefined;
        for (let parentElement = (component.element.parentElement ?? undefined) as HTMLElement | undefined; parentElement !== undefined; parentElement = (parentElement.parentElement ?? undefined) as HTMLElement | undefined) 
        {
            const parentComponent = parentElement.component;

            if (this._app.typeUtil.is<IInitializer>(parentComponent, IInitializerType) === true && parentComponent.isInitializerForComponent(component)) 
            {
                initializer = parentComponent;
                break;
            }
        }

        if (initializer === undefined) this._app.throw('Cannot find initializer for manual init component', [component.className], {correctable:true});

        return initializer;
    }
    
    /**
     * Initializes an array of components by calling their `fnit` method, and returns an array of tuples containing the component and its `fnit` function (if any).
     * 
     * @param objects - An array of `ComponentRecord` objects to initialize.
     * @param manualInitMap - A `Map` of components and their manual initializers.
     * @param log - A boolean indicating whether to only log errors during initialization.
     * @returns An array of tuples containing the component and its `fnit` function (if any).
     */
    async #fnitComponents(childDepthGroups:Array<Array<ComponentRecord<A>>>, log:boolean):Promise<Array<Array<ComponentRecord<A>>>>
    {
        //fnitialize components by depth group, starting with the shallowest
        for (let depth = 0, length = childDepthGroups.length; depth < length; depth++) 
        {
            const sameLevelComponents = childDepthGroups[depth];
            const promises:Array<Promise<any>> = [];

            for (const object of sameLevelComponents) 
            {
                const component = object.component!;

                if (object.transient === true) continue;

                component.__initializationState = NitState.Fniting;

                if (object.initializer !== undefined) //manual init
                {
                    const initializer = object.initializer;
    
                    promises.push(initializer.fnit(initializer, component).then(() => { component.__initializationState = NitState.Fnited; })); //parent component handles this case
                    continue;
                }

                component.__initializationState = NitState.Initing;
                promises.push(component.fnit.apply(component, object.fnitArgs ?? []).then(() => { component.__initializationState = NitState.Fnited; }));
            }

            //await all fnitializations at this depth level
            await Promise.all(promises);
        }

        return childDepthGroups;
    }

    async #readyComponents(childDepthGroups:Array<Array<ComponentRecord<A>>>, log:boolean):Promise<void>
    {
        //readys components by depth group, starting with the deepest
        for (let depth = childDepthGroups.length; depth--;) 
        {
            const sameLevelComponents = childDepthGroups[depth];
            const promises:Array<Promise<any>> = [];

            for (const object of sameLevelComponents) 
            {
                const component = object.component!;

                if (object.transient === true) continue;

                component.__initializationState = NitState.Readying;

                if (component.dnited === true) 
                {
                    await component.dnit(false);
                    continue; //dnit was called while the component was initializing, be sure to dnit it now that it has finished
                }

                promises.push(component.ready().then(async () => 
                {
                    if (component.dnited === true) 
                    {
                        await component.dnit(false); //dnit should already have been called at the ready stage, but call it again just in case...
                        return;
                    }
                    
                    component.__onReadyComplete();
                }));
            }

            //await all at this depth level
            await Promise.all(promises);
        }
    }

    public async loadTransientComponent(component:IComponent<A>):Promise<void>
    {
        if (component.isTransient !== true) this._app.throw('Cannot load a non-transientable component: {className}', [component.className], {correctable:true});

        const element = component.element;

        if (component.__initializationState !== NitState.Nited && component.__initializationState !== NitState.Dnited) this._app.throw('transient component in invalid state prior to pniting', [component.className, component.__initializationState], {correctable:true});

        component.__initializationState = NitState.Pniting;

        component.pnit(); //let the component process the html before we create components within it

        component.__initializationState = NitState.Pnited;

        let objects = this._app.componentUtil.findElements<A>(element, component);
        [objects] = this.#constructComponents(component, objects, false);

        if (this._app.typeUtil.is<IInitializer>(component, IInitializerType)) component.vnit();

        if (component.requiresManualInitialization) this._app.throw('transient components do not support manual init', [component.className], {correctable:true}); //we wouldn't be able to verify they have been initialized if we allowed them to be transient

        const childDepthGroups = await this.#initComponents(objects, false);

        component.__initializationState = NitState.Initing;

        await component.init(); //dfs, so call this last

        component.__initializationState = NitState.Inited;
        component.__initializationState = NitState.Fniting;

        await component.fnit(); //bfs, so call this first

        component.__initializationState = NitState.Fnited;

        await this.#fnitComponents(childDepthGroups, false);

        await this.#readyComponents(childDepthGroups, false);

        component.__initializationState = NitState.Readying;

        if (component.dnited === true) await component.dnit(false); //dnit was called while the component was initializing, be sure to dnit it now that it has finished
        else await component.ready().then(async () => 
        {
            if (component.dnited === true) 
            {
                await component.dnit(false); //dnit should already have been called at the ready stage, but call it again just in case...
                return;
            }

            component.__onReadyComplete();
        }); //dfs, so call this last
    }
}

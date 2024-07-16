/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../../IBaseApp";
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor";
import { DestructableEntity } from "../../../../../../../../shared/src/library/entity/DestructableEntity";

type DOMTreeViewOptions = 
{
    skip?:boolean;
    skipChildren?:boolean; 
    content?:HTMLElement;
}

export class DOMTreeView<A extends IBaseApp<A>> extends DestructableEntity<A>
{  
    private _rootElement:Element;
    private _targetElement:Element;

    /**
     * @private
     * @type {Function}
     * @description Callback executed when a new DOM element is added. 
     * - If it returns `{skip:true}`, neither the node nor its descendants will be added to the tree view.
     * - If it returns `{skipChildren:true, title:"someTitle"}`, the node will be added, but its descendants won't.
     * - If it returns `{title:"someTitle"}`, both the node and its descendants will be added.
     * @returns {{ skip?: boolean, skipChildren?: boolean, title?: string } | void} The behavior and title configuration for the node.
     */
    private _onAdded:(element:Element, node:Element) => DOMTreeViewOptions | void;
    private _onRemoved:(element:Element, node:Element) => void;

    private _observer:MutationObserver;
    private _skipChildrenSymbol = Symbol("skipChildren"); //symbol to mark elements where children should be skipped.

    constructor(app:A, destructor:IDestructor<A>, rootElement:Element, targetElement:Element, onAdded:(element:Element, node:Element) => DOMTreeViewOptions| void, onRemoved:(element:Element, node:Element) => void) 
    {
        super(app, destructor);

        this._rootElement = rootElement;
        this._targetElement = targetElement;
        this._onAdded = onAdded;
        this._onRemoved = onRemoved;

        (targetElement as any)[this._skipChildrenSymbol] = true; //mark the target element to skip its children (the target element is the root of the tree view).

        const ul = document.createElement('ul');
        this._targetElement.appendChild(ul);
        this.#addDOMNodes(this._rootElement, ul);

        //initializing the MutationObserver with the handler for DOM changes.
        this._observer = new MutationObserver(this.#handleMutations);
        this._observer.observe(this._rootElement, {childList:true, subtree:true});
    }

    #handleMutations = (mutations:MutationRecord[]) =>
    {
        this._observer.disconnect(); //important to disconnect the observer before making any changes to the DOM

        //first, process removals
        for (const mutation of mutations) 
        {
            //@ts-ignore
            for (const node of mutation.removedNodes) 
            {
                if (node instanceof Element) 
                {
                    const correspondingLI = this.#findCorrespondingLI(node);
                    if (!correspondingLI) continue; 
                    
                    this._onRemoved(node, correspondingLI);
                    correspondingLI.remove();
                }
            }
        }

        //then, process additions
        for (const mutation of mutations) 
        {
            //@ts-ignore
            for (const node of mutation.addedNodes) 
            {
                if (node instanceof Element) 
                {
                    const realParent = node.parentElement ?? undefined;
                    
                    if (realParent === undefined) continue;  //skip if realParent is undefined.

                    if (this.#hasSkipChildrenSymbol(node)) continue;
                    
                    const correspondingUL = this.#findCorrespondingUL(realParent);
                    if (!correspondingUL) throw new Error('Could not find corresponding UL');

                    const ancestorLI = this.#findCorrespondingLI(realParent);
                    const ancestorResult = ancestorLI ? this._onAdded(realParent, ancestorLI) : undefined;
                    this.#addDOMNodes(node, correspondingUL, ancestorResult?.skipChildren);
                }
            }
        }

        this._observer.observe(this._rootElement, {childList:true, subtree:true});
    }

    public skipChildren(node:Element, skip:boolean):void
    {
        const realParent = node.parentElement ?? undefined;               
        if (realParent === undefined) return;  //skip if realParent is undefined.

        if ((node as any)[this._skipChildrenSymbol] === skip) return; //skip if the node is already marked with the same skip value.

        this._observer.disconnect(); //important to disconnect the observer before making any changes to the DOM

        (node as any)[this._skipChildrenSymbol] = skip;

        if (skip === true)
        {
            //iterate through all descendants of the node and remove them
            const toRemove:Element[] = [];
            node.querySelectorAll('*').forEach((element) =>
            {
                const correspondingLI = this.#findCorrespondingLI(element);
                if (!correspondingLI) return; 
                
                this._onRemoved(element, correspondingLI);
                toRemove.push(correspondingLI);
            });

            for (const li of toRemove) li.remove();
        }
        else
        {
            //iterate through children of the node and add them
            for (const child of Array.from(node.children))
            {
                const correspondingUL = this.#findCorrespondingUL(node);
                if (!correspondingUL) throw new Error('Could not find corresponding UL');

                const ancestorLI = this.#findCorrespondingLI(node);
                const ancestorResult = ancestorLI ? this._onAdded(child, ancestorLI) : undefined;
                this.#addDOMNodes(child, correspondingUL, ancestorResult?.skipChildren);
            }
        }

        this._observer.observe(this._rootElement, {childList:true, subtree:true});
    }

    #findCorrespondingUL(element:Element):HTMLElement | undefined 
    {
        if (element === this._rootElement) return this._targetElement.querySelector('ul') ?? undefined;
        
        const li = this.#findCorrespondingLI(element);
        let ul = li?.querySelector('ul');
        if (ul) return ul; 
        
        ul = document.createElement('ul');
        li?.appendChild(ul);

        return ul;
    }

    static #_id = 0;
    #findCorrespondingLI(element:Element):Element | undefined
    {
        return this._targetElement.querySelector(`[data-dom-ref="${element.getAttribute('data-dom-id')}"]`) ?? undefined;
    }

    #addDOMNodes(element:Element, parentUl:Element, skipChildrenOfAncestor?:boolean) 
    {
        if (element === this._targetElement) return;

        const li = document.createElement('li');
        const icon = document.createElement('span');
        icon.classList.add('icon');
        li.appendChild(icon);
        parentUl.appendChild(li);

        const result = this._onAdded(element, li);
        if (result?.skip) 
        {
            li.remove();
            return;
        }

        if (result?.content) li.appendChild(result?.content);
        else li.remove();
        
        let id = (DOMTreeView.#_id++).toString();
        element.setAttribute('data-dom-id', id);
        li.setAttribute('data-dom-ref', id);

        if (result?.skipChildren) (element as any)[this._skipChildrenSymbol] = true;

        const shouldSkipChildren = result?.skipChildren ?? skipChildrenOfAncestor;
        if (!shouldSkipChildren) 
        {
            const children = Array.from(element.children);
            if (children.length) 
            {
                const ul = document.createElement('ul');
                li.appendChild(ul);

                for (const child of children) this.#addDOMNodes(child, ul);
            }
        }
    }

    #hasSkipChildrenSymbol(element:Element):boolean 
    {
        let node:Element | undefined = element;

        //check the given element and its ancestors for the skipChildren Symbol.
        const rootElement = this._rootElement;
        const skipChildrenSymbol = this._skipChildrenSymbol;
        while (node && node !== rootElement) 
        {
            if ((node as any)[skipChildrenSymbol]) return true;
            
            node = node.parentElement ?? undefined;
        }

        return false;
    }

    public override async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        this._observer.disconnect();

        return true;
    }
}
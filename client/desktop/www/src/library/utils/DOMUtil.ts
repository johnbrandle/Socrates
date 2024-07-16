/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

@SealedDecorator()
export class DOMUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    /**
     * Searches for elements with a specified attribute name and value in the given root element and its descendants.
     *
     * @template T - The type of the elements being searched for.
     * @param {Element} rootElement - The root element to start searching from.
     * @param {string} attributeName - The attribute name to look for.
     * @param {string} attributeValue - The attribute value to match.
     * @param {boolean} [one=false] - Optional. If true, the search stops after finding the first matching element.
     * @param {Array<Element>} [exclude] - Optional. An array of elements to be excluded from the search.
     * @returns {Array<T>} An array of found elements of the specified type.
     * @example
     * const rootElement = document.querySelector('#container');
     * const attributeName = 'data-custom-attr';
     * const attributeValue = 'target';
     * const one = true;
     * const exclude = [document.querySelector('#exclude-element')];
     *
     * const result = this.find<Element>(rootElement, attributeName, attributeValue, one, exclude);
     * ConsoleUtil.log(result); // Output: Array of found elements
     */
    public find<T>(rootElement:Element, attributeName:string, attributeValue?:string, one?:true, exclude?:(rootElement:Element, element:Element) => [boolean, boolean]):T; 
    public find<T>(rootElement:Element, attributeName:string, attributeValue?:string, one?:false, exclude?:(rootElement:Element, element:Element) => [boolean, boolean]):Array<T>; 
    public find<T>(rootElement:Element, attributeName:string, attributeValue?:string, one?:boolean, exclude?:(rootElement:Element, element:Element) => [boolean, boolean])
    {
        const result:Array<T> = [];
        const childChildren:Array<Array<Element> | HTMLCollection> = [[rootElement]];
        const excludeResult = [false, false];
        
        let index = 0;
        while (index < childChildren.length) 
        {
            const children = childChildren[index];
            
            index++;

            for (let i = 0, length = children.length; i < length; i++) 
            {
                const child = children[i];

                const [excludeChild, excludeChildrenOfChild] = exclude ? exclude(rootElement, child) : excludeResult;
                
                if (excludeChild === true) continue;
                if (child.children.length > 0 && excludeChildrenOfChild !== true) childChildren.push(child.children);
                
                if (child.hasAttribute(attributeName) === false) continue;
                if (attributeValue !== undefined && child.getAttribute(attributeName) !== attributeValue) continue;
                
                if (one === true) return child as T;

                result.push(child as T);
            }
        }

        return one === true ? undefined : result;
    }

    /**
     * Sets the value of one or more properties of the current object using the provided names or a Record object.
     * 
     * @template T
     * @param {string | Array<string> | Record<string, T>} name - The name or names of the property/properties to set, or a Record object where the keys are the property names and the values are the property values.
     * @param {Element} [element] - The element that the property belongs to, if applicable.
     * @returns {void}
     */
    public set = (rootElement:Element, object:Record<string, any>, attributeName:string='name'):void =>
    {
        for (const key in object)
        {
            const elements = this.find<Element>(rootElement, attributeName, key, false);
            object[key] = elements.length > 1 ? elements : elements[0];
        }
    }

    /**
     * Retrieves all descendant elements of a given node.
     *
     * @param {Element} node - The element whose descendants are to be retrieved.
     * @returns {Array<Element>} An array containing all the descendant elements of the given node.
     * @example
     * const descendants = DOMUtil.getDescendants(rootNode);
     * ConsoleUtil.log(descendants); // Output: Array of descendant elements
     */
    public getDescendants(node:Element):Array<Element> 
    {
        const stack = [node];
        const accum:Array<Element> = [];

        while (stack.length > 0) 
        {
            const current = stack.pop();

            if (current === undefined) continue; 
            if (current !== node) accum.push(current);
            
            const children = current.children;
            for (let i = children.length; i--;) stack.push(children[i]);
        }
    
        return accum;
    }

    /**
     * Retrieves all ancestor elements of a given node.
     * 
     * @param {Element} node - The element whose ancestors are to be retrieved.
     * @returns {Array<Element>} An array containing all the ancestor elements of the given node.
     * @example
     * const ancestors = DOMUtil.getAncestors(node);
     * ConsoleUtil.log(ancestors); // Output: Array of ancestor elements
     */
    public getAncestors(node:Element):Array<Element>
    {
        const accum:Array<Element> = [];

        let current:Element | undefined = node;
        while (current = current.parentElement ?? undefined) accum.push(current);

        return accum;
    }
    
    /**
     * Recursively generates the innerHTML string representation of an element, including
     * its child descendants. This function supports HTML, SVG, and MathML elements.
     * I think I created this because of transients, but I don't remember.
     *
     * @param {HTMLElement | SVGElement | Element} element - The element to generate the innerHTML for.
     * @returns {string} The generated innerHTML string.
     *
     * @example
     * const element = document.getElementById('example');
     * const innerHTMLString = createInnerHTML(element);
     * ConsoleUtil.log(innerHTMLString);
     */
    public getInnerHTML = (element:HTMLElement | SVGElement | Element):string =>
    {
        if (!element.hasChildNodes()) return ''; //base case: if the element has no child nodes, return an empty string
        
        const selfClosingTags = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']; //list of self-closing tags
      
        let innerHTML = ''; //initialize an empty string to store the generated HTML content
      
        const childNodes = element.childNodes;
        for (let i = 0, length = childNodes.length; i < length; i++)  //iterate through the child nodes of the element
        {
            const child = childNodes[i];
        
            if (child.nodeType === Node.ELEMENT_NODE) 
            {
                //if the child is an element, cast it to an Element
                const childElement = child as Element;
                const tagName = childElement.tagName.toLowerCase();
                
                const namespaceURI = childElement.namespaceURI; //handle the namespace
                const isSVG = namespaceURI === 'http://www.w3.org/2000/svg';
                const isMathML = namespaceURI === 'http://www.w3.org/1998/Math/MathML';
                const prefix = isSVG ? 'svg:' : isMathML ? 'math:' : '';
            
                //generate the opening tag with attributes
                innerHTML += `<${prefix}${tagName}`;
                for (let j = 0; j < childElement.attributes.length; j++) 
                {
                    const attr = childElement.attributes[j];
                    innerHTML += ` ${attr.name}="${attr.value}"`;
                }
            
                //check if the element is a self-closing tag
                if (selfClosingTags.includes(tagName)) innerHTML += ' />';
                else 
                {
                    innerHTML += '>';

                    let htmlElement = childElement as HTMLElement;
                    if (htmlElement.component !== undefined && htmlElement.component.isTransient === true) innerHTML += htmlElement.component.html; //transients keeep a reference to the original html
                    else innerHTML += this.getInnerHTML(childElement); //recursively generate the innerHTML for child elements
                    
                    innerHTML += `</${prefix}${tagName}>`; //generate the closing tag
                }
            } 
            else if (child.nodeType === Node.TEXT_NODE) innerHTML += child.textContent; //if the child is a text node, append its text content
        }
    
        return innerHTML;
    }

    public createDocumentFragment(html:string, preprocess?:(element:HTMLElement) => HTMLElement):DocumentFragment
    {
        const template = document.createElement('template');
        
        template.innerHTML = '<div>' + html + '</div>';
        let element = template.content.firstChild as HTMLElement;

        if (preprocess !== undefined) element = preprocess(element);

        if ((element.querySelector('script') ?? undefined) !== undefined) throw new Error('scripts are unsupported'); //there are many good reasons not to support scripts

        const documentFragment = new DocumentFragment();
        
        let firstChild;
        while (firstChild = element.firstChild) documentFragment.append(firstChild);
        
        return documentFragment;
    }

    public clone<E extends (Element | DocumentFragment)>(element:E, options?:{deep?:boolean, clearIDs?:boolean}):E
    {
        const clone = element.cloneNode(options?.deep ?? true) as E;
        
        if (options?.clearIDs ?? true !== true) return clone; 
        
        //clear ids
        const stack:(Element | DocumentFragment)[] = [clone];
        while (stack.length > 0) 
        {
            const current = stack.pop();
            if (current === undefined) continue; 
            
            if ('removeAttribute' in current) current.removeAttribute('id');
            
            const children = current.children;
            for (let i = children.length; i--;) stack.push(children[i]);
        }
    
        return clone;
    }
}
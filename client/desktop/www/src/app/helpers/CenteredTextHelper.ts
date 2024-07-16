/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Entity } from "../../../../../../shared/src/library/entity/Entity";
import type { IApp } from "../IApp";

type InputElement = HTMLInputElement | HTMLTextAreaElement;

//will keep text centered in an input field
export class CenteredTextHelper<A extends IApp<A>> extends Entity<A>
{
    #_input:InputElement;

    constructor(app:A, input:InputElement)
    {
        super(app);

        this.#_input = input;
    }

    //adjust the text of the key text field to center and resize depending on text size, use offset if some of the space is taken up by elements (see login or register for an example)
    public update(offset:number=0, size=19)
    {
        const input = this.#_input;

        input.style.fontSize = size + 'px';
        
        //create a temporary element with the same styling as the input field
        const inputFieldStyle = window.getComputedStyle(input);
        const tempElement = document.createElement('span');
        tempElement.style.font = inputFieldStyle.font;
        tempElement.style.fontFamily = inputFieldStyle.fontFamily;
        tempElement.style.fontSize = inputFieldStyle.fontSize;
        tempElement.style.fontWeight = inputFieldStyle.fontWeight;
        tempElement.style.lineHeight = inputFieldStyle.lineHeight;
        tempElement.style.letterSpacing = inputFieldStyle.letterSpacing;
        tempElement.style.wordSpacing = inputFieldStyle.wordSpacing;
        tempElement.style.textIndent = inputFieldStyle.textIndent;
        tempElement.style.textRendering = inputFieldStyle.textRendering;
        tempElement.style.textTransform = inputFieldStyle.textTransform;
        tempElement.style.textShadow = inputFieldStyle.textShadow;
        tempElement.style.whiteSpace = 'pre';
        tempElement.style.visibility = 'hidden'; //hide the temporary element
        tempElement.style.position = 'absolute';
        
        tempElement.style.letterSpacing = inputFieldStyle.letterSpacing;
        tempElement.textContent = input.value || input.placeholder;

        document.body.appendChild(tempElement);

        //calculate the width of the text
        const textWidth = tempElement.getBoundingClientRect().width;
        document.body.removeChild(tempElement);

        //distribute the remaining space evenly to both the left and right padding
        let paddingLeft = ((input.offsetWidth + offset) - textWidth) / 2;
        
        let remainingWidth = input.offsetWidth - textWidth - 30; //15 padding
        if (paddingLeft > remainingWidth) 
        {
            paddingLeft = (input.offsetWidth - textWidth) / 2;
            
            if (paddingLeft > remainingWidth && size > 8) this.update(offset, --size);
            else input.style.paddingLeft = `${paddingLeft}px`;
        }
        else input.style.paddingLeft = `${paddingLeft}px`;
    }
}

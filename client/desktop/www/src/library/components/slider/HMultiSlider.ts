/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../IBaseApp";
import { Component } from "../Component";
import { ComponentDecorator } from "../../decorators/ComponentDecorator";
import html from "./HMultiSlider.html";
import { DragAssistant } from "../../../app/assistants/DragAssistant";
import { EventListenerAssistant } from "../../assistants/EventListenerAssistant";
import { Signal } from "../../../../../../../shared/src/library/signal/Signal";
import type { ISignal } from "../../../../../../../shared/src/library/signal/ISignal";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";

class Elements
{
    track!:HTMLElement;
    range!:HTMLElement;
    thumbLeft!:HTMLElement;
    thumbRight!:HTMLElement;

    min!:HTMLElement;
    max!:HTMLElement;
}

enum Direction
{
    Left = -1,
    Right = 1
}

@ComponentDecorator()
export class HMultiSlider<A extends IBaseApp<A>> extends Component<A>
{
    private _eventListenerAssistant!:EventListenerAssistant<A>;

    /**
     * @public
     * @type {Signal}
     * @description Signal emitted on slider movement.
     */
    public readonly onSlideSignal:ISignal<[HMultiSlider<A>, number, number]> = new Signal(this);

    /**
     * @public
     * @type {Signal}
     * @description Signal for left thumb keyboard navigation.
     * 
     * Note: Optionaly, return a percent value to move the thumb to, else the thumb will be moved 1%.
     */
    public readonly onThumbLeftArrowSignal:ISignal<[HMultiSlider<A>, Direction, number, KeyboardEvent], number | undefined> = new Signal(this);
    
    /**
     * @public
     * @type {Signal}
     * @description Signal for right thumb keyboard navigation.
     * 
     * Note: Optionaly, return a percent value to move the thumb to, else the thumb will be moved 1%.
     */
    public readonly onThumbRightArrowSignal:ISignal<[HMultiSlider<A>, Direction, number, KeyboardEvent], number | undefined> = new Signal(this);

    /**
     * Constructs a horizontal multi-slider component.
     * @param {A} app - The application instance.
     * @param {HTMLElement} element - The HTMLElement for the slider.
     */
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    /**
     * Initialization method for the component. Sets up elements, labels, and event listeners.
     * @override
     * @param {...any} args - Additional arguments if any.
     * @returns {Promise<void>} A promise that resolves when the initialization is complete.
     */
    public override async init(...args:any):Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._eventListenerAssistant = new EventListenerAssistant(this._app, this);

        elements.min.innerText = this._element.getAttribute('data-min') ?? 'Min';
        elements.max.innerText = this._element.getAttribute('data-max') ?? 'Max';

        this._eventListenerAssistant.subscribe(elements.track, 'click', (event:MouseEvent) =>
        {
            const position = event.offsetX;
            const thumbWidth = elements.thumbLeft.offsetWidth;
            const thumbLeftPosition = elements.thumbLeft.offsetLeft + thumbWidth;
            const thumbRightPosition = elements.thumbRight.offsetLeft + thumbWidth;

            if (position <= thumbLeftPosition) this.#positionLeftThumb(position - (thumbWidth / 2)); //they clicked to the left of the left thumb, so move the left thumb
            else if (position >= thumbRightPosition) this.#positionRightThumb(this._elements.track.offsetWidth - (position + (thumbWidth / 2))); //they clicked to the right of the right thumb, so move the right thumb
            else //they clicked between the two thumbs, so move both thumbs
            {
                this.#positionLeftThumb(position - thumbWidth);
                this.#positionRightThumb(this._elements.track.offsetWidth - (position + thumbWidth));
            }
        });

        this._eventListenerAssistant.subscribe(elements.thumbLeft, 'keydown', (event:KeyboardEvent) =>
        {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
            {
                const direction = event.key === 'ArrowLeft' ? Direction.Left : Direction.Right;

                let percent = this.#leftPercent;
                const moveToPercent = this.onThumbLeftArrowSignal.dispatch(this, direction, percent, event) ?? percent + direction;
                const left = this.#getLeftPositionByPercent(moveToPercent);
                this.#positionLeftThumb(left);
            }
        });

        this._eventListenerAssistant.subscribe(elements.thumbRight, 'keydown', (event:KeyboardEvent) =>
        {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
            {
                const direction = event.key === 'ArrowLeft' ? Direction.Left : Direction.Right;

                let percent = this.#rightPercent;
                const moveToPercent = 100 - (this.onThumbRightArrowSignal.dispatch(this, direction, percent, event) ?? percent - direction);
                const right = this.#getRightPositionByPercent(moveToPercent);
                this.#positionRightThumb(right);
            }
        });

        new DragAssistant(this._app, this, elements.thumbLeft, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent) => //onDown
        {
        }, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number) => //onDragStart
        {
        }, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, deltaX:number, deltaY:number, currentX:number, currentY:number) => //onDrag 
        {
            const left = (parseFloat(elements.thumbLeft.style.left || '0') + deltaX);
            this.#positionLeftThumb(left);
        }, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, endX:number, endY:number) => //onDragEnd
        {
        });

        new DragAssistant(this._app, this, elements.thumbRight, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent) => //onDown
        {
        }, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number) => //onDragStart
        {
        }, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, deltaX:number, deltaY:number, currentX:number, currentY:number) => //onDrag 
        {
            const right = (parseFloat(elements.thumbRight.style.right || '0') - deltaX);
            this.#positionRightThumb(right);
        }, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, endX:number, endY:number) => //onDragEnd
        {
        });

        return super.init();
    }

    /**
     * Method called when the component is displayed. Positions the slider thumbs initially.
     * @override
     * @param {boolean} initial - Indicates if this is the initial display of the component.
     * @param {IntersectionObserverEntry} entry - Intersection observer entry for visibility handling.
     * @param {CSSStyleDeclaration} style - The CSS style declaration.
     * @returns {Promise<void>} A promise that resolves when the onShow logic is executed.
     */
    public override onShow(initial:boolean, entry:IntersectionObserverEntry, style:CSSStyleDeclaration):Promise<void>
    {
        if (initial === true)
        {
            this.#positionLeftThumb(0);
            this.#positionRightThumb(0);
        }

        return super.onShow(initial, entry, style);
    }

    /**
     * Calculates the percentage position of the left thumb relative to the track.
     * @private
     * @returns {number} The percentage position of the left thumb.
     */
    get #leftPercent():number
    {
        const elements = this._elements;
        const thumbWidth = elements.thumbLeft.offsetWidth;
        const left = parseFloat(elements.thumbLeft.style.left || '0');

        return (left / (elements.track.offsetWidth - (thumbWidth * 2))) * 100;
    }

    /**
     * Converts a percentage to the left position in pixels for the left thumb.
     * @private
     * @param {number} percent - The percentage position to convert.
     * @returns {number} The pixel position from the left for the thumb.
     */
    #getLeftPositionByPercent(percent:number):number
    {
        const elements = this._elements;
        const thumbWidth = elements.thumbLeft.offsetWidth;

        return (percent / 100) * (elements.track.offsetWidth - (thumbWidth * 2));
    }

    /**
     * Calculates the percentage position of the right thumb relative to the track.
     * @private
     * @returns {number} The percentage position of the right thumb.
     */
    get #rightPercent():number
    {
        const elements = this._elements;
        const thumbWidth = elements.thumbRight.offsetWidth;
        const right = parseFloat(elements.thumbRight.style.right || '0');

        return 100 - ((right / (elements.track.offsetWidth - (thumbWidth * 2))) * 100);
    }

    /**
     * Converts a percentage to the right position in pixels for the right thumb.
     * @private
     * @param {number} percent - The percentage position to convert.
     * @returns {number} The pixel position from the right for the thumb.
     */
    #getRightPositionByPercent(percent:number):number
    {
        const elements = this._elements;
        const thumbWidth = elements.thumbRight.offsetWidth;

        return (percent / 100) * (elements.track.offsetWidth - (thumbWidth * 2));
    }

    public getValues():[number, number]
    {
        return [this.#leftPercent, this.#rightPercent];
    }

    public setValues(left:number, right:number):void
    {
        this.#positionLeftThumb(this.#getLeftPositionByPercent(left));
        this.#positionRightThumb(this.#getRightPositionByPercent(100 - right));
    }

    /**
     * Positions the left thumb at a specified pixel position.
     * This method is responsible for moving the left thumb along the slider track.
     * @private
     * @param {number} left - The pixel position from the left to place the left thumb.
     */
    #positionLeftThumb(left:number):void
    {
        const elements = this._elements;
        const thumbWidth = elements.thumbLeft.offsetWidth;

        //ensuring left position does not go beyond the left boundary of the track.
        if (left < 0) left = 0;

        //get the current position of the right thumb for comparison.
        const thumb2Position = elements.thumbRight.offsetLeft;
        
        //check if the new left position overlaps with the right thumb.
        //the overlap check accounts for the width of the thumbs.
        if (left > thumb2Position - thumbWidth) 
        {
            const diff = left - (thumb2Position - thumbWidth);
            const right = parseFloat(elements.thumbRight.style.right || '0');
            
            //adjust right thumb position if there's an overlap.
            if (right > 0) 
            {
                //move the right thumb to resolve overlap.
                this.#positionRightThumb(right - diff);

                //adjust the left thumb position again after moving the right thumb.
                left += Math.min(diff, Math.max(0, diff - right));
            }
            else 
            {
                //if the right thumb can't move further, set the left thumb to its maximum position.
                left = thumb2Position - thumbWidth;
            }
        }

        //set the new position for the left thumb and update the visual range.
        elements.thumbLeft.style.left = left + 'px';
        this.#updateRange();

        //dispatch the slide signal with the percentage positions of both thumbs.
        let percentLeft = Math.max(0, Math.min(100, (left / (elements.track.offsetWidth - (thumbWidth * 2))) * 100));
        let percentOfThumbRight = 100 - this.#rightPercent;
        
        //ensure the combined percentages do not exceed 100%.
        if (percentLeft + percentOfThumbRight > 100) percentLeft = 100 - percentOfThumbRight;
        this.onSlideSignal.dispatch(this, percentLeft, 100 - percentOfThumbRight);
    }

    /**
     * Positions the right thumb at a specified pixel position.
     * This method is responsible for moving the right thumb along the slider track.
     * @private
     * @param {number} right - The pixel position from the right to place the right thumb.
     */
    #positionRightThumb(right:number):void
    {
        const elements = this._elements;
        const thumbWidth = elements.thumbLeft.offsetWidth;

        //ensuring right position does not go beyond the right boundary of the track.
        if (right < 0) right = 0;

        //get the current position of the left thumb for comparison.
        const thumb1Position = elements.track.offsetWidth - (elements.thumbLeft.offsetLeft + thumbWidth);
        
        //check if the new right position overlaps with the left thumb.
        if (thumb1Position < right + thumbWidth) 
        {
            const diff = right + thumbWidth - thumb1Position;
            const left = parseFloat(elements.thumbLeft.style.left || '0');
            
            //adjust left thumb position if there's an overlap.
            if (left > 0) 
            {
                //move the left thumb to resolve overlap.
                this.#positionLeftThumb(left - diff);

                //adjust the right thumb position again after moving the left thumb.
                right += Math.min(diff, Math.max(0, diff - left));
            }
            else 
            {
                //if the left thumb can't move further, set the right thumb to its maximum position.
                right = thumb1Position - thumbWidth;
            }
        }

        //set the new position for the right thumb and update the visual range.
        elements.thumbRight.style.right = right + 'px';
        this.#updateRange();

        //dispatch the slide signal with the percentage positions of both thumbs.
        let percentRight = Math.max(0, Math.min(100, (right / (elements.track.offsetWidth - (thumbWidth * 2))) * 100));
        let percentOfThumbLeft = this.#leftPercent;
        
        //ensure the combined percentages do not exceed 100%.
        if (percentRight + percentOfThumbLeft > 100) percentRight = 100 - percentOfThumbLeft;
        this.onSlideSignal.dispatch(this, percentOfThumbLeft, 100 - percentRight);
    }

    /**
     * Updates the range element to reflect the current positions of the thumbs.
     * @private
     */
    #updateRange():void
    {
        const elements = this._elements;
        const thumbWidth = elements.thumbLeft.offsetWidth;

        elements.range.style.left = (elements.thumbLeft.offsetLeft + (thumbWidth / 2)) + 'px';
        elements.range.style.width = elements.thumbRight.offsetLeft - elements.thumbLeft.offsetLeft + 'px';
    }

    /**
     * Sets the labels for the left and right ends of the slider.
     * @public
     * @param {string} leftLabelText - Text for the left label.
     * @param {string} rightLabelText - Text for the right label.
     */
    public setLabels(leftLabelText:string, rightLabelText:string)
    {
        const elements = this._elements;

        elements.max.innerText = rightLabelText;
        elements.min.innerText = leftLabelText;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}

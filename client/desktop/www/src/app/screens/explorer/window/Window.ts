/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Component } from '../../../../library/components/Component.ts';
import type { IApp } from '../../../IApp.ts';
import html from './Window.html';
import { DragAssistant } from '../../../assistants/DragAssistant.ts';
import type { IStorage } from '../../../../../../../../shared/src/library/storage/IStorage.ts';
import { GlobalEvent } from '../../../../library/managers/GlobalListenerManager.ts';
import type { IWindowable } from './IWindowable.ts';
import { ComponentDecorator } from '../../../../library/decorators/ComponentDecorator.ts';
import { WindowElements } from './WindowElements.ts';
import { PrimitiveStore } from '../../../../../../../../shared/src/library/storage/store/PrimitiveStore.ts';
import { ObjectStore } from '../../../../../../../../shared/src/library/storage/store/ObjectStore.ts';
import { GroupStore } from '../../../../../../../../shared/src/library/storage/store/GroupStore.ts';
import { IWindowableType } from './IWindowable.ts';
import { IContextableType, type IContextable } from '../../../../library/components/IContextable.ts';
import type { IContextMenuData } from '../../../../library/managers/IContextMenuManager.ts';
import { TweenAssistant, easeOutQuad } from '../../../../library/assistants/TweenAssistant.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';
import { EventListenerAssistant } from '../../../../library/assistants/EventListenerAssistant.ts';
import { ImplementsDecorator } from '../../../../../../../../shared/src/library/decorators/ImplementsDecorator.ts';

export interface IWindowDisplayOptions extends JsonObject
{
    from:IWindowDimensions;
    to:IWindowDimensions;
}

export interface IWindowDimensions extends JsonObject
{
    top?:number;
    left?:number;
    width?:number;
    height?:number;
}

export interface IWindowStorage<A extends IApp<A>>
{
    app:IStorage<A>;
    window:IStorage<A>;
}

enum Edge 
{
    RIGHT = 'right',
    BOTTOM = 'bottom',
    LEFT = 'left',
    TOP = 'top'
}

enum DisplayState
{
    UNINITIALIZED = 0,
    MINIMIZED = 1,
    NORMAL = 2,
    MAXIMIZED = 3,
}

const STICKY_THRESHOLD = -5; //user will need to drag past the edge of the parent by this many pixels before the window will stick to the edge

@ComponentDecorator()
@ImplementsDecorator(IContextableType)
export abstract class Window<A extends IApp<A>> extends Component<A> implements IContextable
{
    private readonly _storage:IWindowStorage<A>;
    private readonly _appID:string;
    private readonly _windowID:string;

    private readonly _displayState:PrimitiveStore<A, DisplayState>;
    private readonly _preferredDimensions:ObjectStore<A, Record<DisplayState, IWindowDimensions>>;
    private readonly _stickyEdges:ObjectStore<A, Record<Edge, boolean>>;
    private readonly _groupStore:GroupStore<A>;

    private _displayOptions:IWindowDisplayOptions | undefined;

    private readonly _singleWindowMode:boolean; //if true, this window is in its own popup browser window (value will not change)
    private _transferedToOwnWindow:boolean = false; //if true, this window was transfered to its own popup browser window (but it is still in the parent window as well, and will be restored when the popup is closed, so this value may change)

    protected _eventListenerAssistant!:EventListenerAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, appID:string, windowID:string, storage:IWindowStorage<A>, displayOptions?:IWindowDisplayOptions) 
    {
        super(app, destructor, element, html);

        this._storage = storage;
        this._appID = appID;
        this._windowID = windowID;
        this._displayOptions = displayOptions;

        this._element.style.visibility = 'hidden';
        this._element.style.top = (displayOptions?.from.top || 0) + 'px';
        this._element.style.left = (displayOptions?.from.left || 0) + 'px';

        this._singleWindowMode = this._app.environment.frozen.isSingleWindowMode;

        this._displayState = new PrimitiveStore<A, DisplayState>(storage.window, 'display-state', DisplayState.UNINITIALIZED);
        this._preferredDimensions = new ObjectStore<A, Record<DisplayState, IWindowDimensions>>(storage.window, 'preferred-dimensions', 
        {
            [DisplayState.UNINITIALIZED]: {}, //this is the initial state, so it should never be used
            [DisplayState.MINIMIZED]: {},
            [DisplayState.NORMAL]: {},
            [DisplayState.MAXIMIZED]: {},
        });
        this._stickyEdges = new ObjectStore<A, Record<Edge, boolean>>(storage.window, 'sticky-edges', {top:false, bottom:false, left:false, right:false});

        this._groupStore = new GroupStore(this._app, [this._displayState, this._preferredDimensions, this._stickyEdges], () => !this._app.environment.frozen.isSingleWindowMode);

        this._eventListenerAssistant = new EventListenerAssistant(this._app, this);

        this._app.contextMenuManager.add(this);
    }

    public override async init(...args:any):Promise<void>
    { 
        await super.init();

        //restore state
        await this._groupStore.restore();

        let preferredDimensions = this._preferredDimensions.value;

        const state = this._displayState;
        if (state.value === DisplayState.UNINITIALIZED)
        {
            state.value = DisplayState.NORMAL;

            let displayOptions = this._displayOptions;
            if (displayOptions !== undefined)
            {
                preferredDimensions[DisplayState.NORMAL].top = displayOptions.to.top;
                preferredDimensions[DisplayState.NORMAL].left = displayOptions.to.left;
                preferredDimensions[DisplayState.NORMAL].width = displayOptions.to.width;
                preferredDimensions[DisplayState.NORMAL].height = displayOptions.to.height;
            }
        }

        const singleWindowMode = this._app.environment.frozen.isSingleWindowMode;

        if (singleWindowMode !== true) this.#initDoubleClickOnHeader(); 
        if (singleWindowMode !== true) this.#initDragOnHeader(); 
        if (singleWindowMode !== true) this.#initResizeWithHandles(); 
        if (singleWindowMode !== true) this.#initButtons(); 

        this._groupStore.commit();
    }

    #initDoubleClickOnHeader():void
    {
        //add event listener to detect double click for minimize/maximize
        let clickCount = 0;
        let timer:number;
        this._eventListenerAssistant.subscribe(this._elements.windowHeader, 'click', () =>
        {
            clickCount++;
        
            if (clickCount === 1) 
            {
                timer = window.setTimeout(() => 
                {
                    clickCount = 0; //reset the click count if the second click doesn't happen quickly
                }, 300); //300ms is the typical delay for detecting double clicks
            } 
            else if (clickCount === 2) 
            {
                clearTimeout(timer); //cancel the timer to avoid resetting clickCount

                const parentBounds = this.#getParentBounds();

                let width = parentBounds.right - parentBounds.left;
                let height = parentBounds.bottom - parentBounds.top;

                const isAlreadySizeOfBounds = parseInt(this._element.style.width) === width && parseInt(this._element.style.height) === height;
                if ((this._displayState.value === DisplayState.NORMAL && !isAlreadySizeOfBounds) || this._displayState.value === DisplayState.MINIMIZED) //fill the available space
                {
                    if (this._displayState.value === DisplayState.MINIMIZED) this.#displayState(DisplayState.NORMAL, false);
                    
                    this.moveWithinParentBounds({top:parentBounds.top, left:parentBounds.left, width:width, height:height}, false);

                    this.#handleStickyEdge(Edge.RIGHT, true);
                    this.#handleStickyEdge(Edge.BOTTOM, true);
                    this.#handleStickyEdge(Edge.LEFT, true);
                    this.#handleStickyEdge(Edge.TOP, true);

                    this._groupStore.commit();
                }
                else this.#displayState(DisplayState.MINIMIZED, false);
                
                clickCount = 0; //reset the click count after handling the double click
            }
        });
    }

    #initDragOnHeader():void
    {
        let originalTop:number | undefined;
        let originalLeft:number | undefined;
        let originalOffsetX:number | undefined;
        let originalOffsetY:number | undefined;
        let top = 0;
        let left = 0;
        new DragAssistant(this._app, this, this._elements.windowHeader, (dragAssistant:DragAssistant<A>, event:PointerEvent) => 
        {
            top = originalTop = parseFloat(this._element.style.top) || 0;
            left = originalLeft = parseFloat(this._element.style.left) || 0;

            originalOffsetX = event.offsetX;
            originalOffsetY = event.offsetY;
        },
        () => 
        {
            return {momentum:{multiplier:75, threshold:30, max:Math.max(this._element.offsetWidth, this._element.offsetHeight), duration:500, ease:undefined}};
        }, 
        (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, deltaX:number, deltaY:number) => 
        { 
            top += deltaY;
            left += deltaX;

            this._element.style.top = top + 'px';
            this._element.style.left = left + 'px';

            this._preferredDimensions.value[this._displayState.value].top = top;
            this._preferredDimensions.value[this._displayState.value].left = left;
        }, (dragAssistant:DragAssistant<A>, event:PointerEvent) =>  
        {
            //see if this was dragged completely outside of the parent bounds, if so, transfer it to its own window
            //already transfered to own window, don't do it again. //TODO, focus the transferred window
            //don't transfer to own window on mobile, as it is not supported
            if (this.isTransferable && !this._transferedToOwnWindow && !this._app.environment.frozen.isMobile)
            {
                let bounds = this.#getParentBounds();
                if (this._element.offsetTop > bounds.bottom || this._element.offsetLeft > bounds.right || this._element.offsetLeft + this._element.offsetWidth < bounds.left || this._element.offsetTop + this._element.offsetHeight < bounds.top)
                {
                    let screenX = event.screenX - originalOffsetX!;
                    let screenY = event.screenY - originalOffsetY!;
        
                    this.#getParent().windowManager.transferWindowToOwnWindow(this, screenX, screenY);

                    this._preferredDimensions.value[this._displayState.value].top = originalTop;
                    this._preferredDimensions.value[this._displayState.value].left = originalLeft;
                    return;
                }
            }

            this.#handleStickyEdge(Edge.RIGHT);
            this.#handleStickyEdge(Edge.BOTTOM);
            this.#handleStickyEdge(Edge.LEFT);
            this.#handleStickyEdge(Edge.TOP);
        
            let state = this._displayState;
            if (state.value === DisplayState.MAXIMIZED) state.value = DisplayState.NORMAL; //they dragged while maximized, so set the state to normal
            
            this.#displayState(state.value, false);

            this._groupStore.commit();
        }, 5);
    }

    #initResizeWithHandles():void
    {
        const onResize = (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, deltaX:number, deltaY:number):void => 
        {
            const resizeDimension = (currentValue:number, delta:number, minSize:number) => //resize a dimension (width or height)
            {
                let newSize = currentValue + delta;
                let actualDelta = delta;
                if (newSize < minSize) 
                {
                    actualDelta = minSize - currentValue;
                    newSize = minSize;
                }
    
                return { newSize, actualDelta };
            }

            const element = dragAssistant.element;
            let newWidth = parseFloat(this._element.style.width) || this._element.offsetWidth;
            let newHeight = parseFloat(this._element.style.height) || this._element.offsetHeight;
            let actualDx = 0;
            let actualDy = 0;
          
            if (element.classList.contains('top') || element.classList.contains('top-right') || element.classList.contains('top-left')) 
            {
                const result = resizeDimension(newHeight, -deltaY, this.minHeight);
                newHeight = result.newSize;
                actualDy = -result.actualDelta;

                //manually resizing an element should clear the saved position and size (see resize handler), so that it doesn't try to go back to where it was before
                this._preferredDimensions.value[this._displayState.value].top = (parseFloat(this._element.style.top) || 0) + actualDy;
                this._preferredDimensions.value[this._displayState.value].height = newHeight;
            }
          
            if (element.classList.contains('left') || element.classList.contains('bottom-left') || element.classList.contains('top-left')) 
            {
                const result = resizeDimension(newWidth, -deltaX, this.minWidth);
                
                newWidth = result.newSize;
                actualDx = -result.actualDelta;

                //manually resizing an element should clear the saved position and size (see resize handler), so that it doesn't try to go back to where it was before
                this._preferredDimensions.value[this._displayState.value].left = (parseFloat(this._element.style.left) || 0) + actualDx;
                this._preferredDimensions.value[this._displayState.value].width = newWidth;
            }
          
            if (element.classList.contains('right') || element.classList.contains('bottom-right') || element.classList.contains('top-right'))
            {
                const result = resizeDimension(newWidth, deltaX, this.minWidth);
                newWidth = result.newSize;

                //manually resizing an element should clear the saved position and size (see resize handler), so that it doesn't try to go back to where it was before
                this._preferredDimensions.value[this._displayState.value].left = (parseFloat(this._element.style.left) || 0) + actualDx;
                this._preferredDimensions.value[this._displayState.value].width = newWidth;
            }
          
            if (element.classList.contains('bottom') || element.classList.contains('bottom-right') || element.classList.contains('bottom-left')) 
            {
                const result = resizeDimension(newHeight, deltaY, this.minHeight);
                newHeight = result.newSize;

                //manually resizing an element should clear the saved position and size (see resize handler), so that it doesn't try to go back to where it was before
                this._preferredDimensions.value[this._displayState.value].top = (parseFloat(this._element.style.top) || 0) + actualDy;
                this._preferredDimensions.value[this._displayState.value].height = newHeight;
            }
          
            //update element
            this._element.style.top = (parseFloat(this._element.style.top) || 0) + actualDy + 'px';
            this._element.style.left = (parseFloat(this._element.style.left) || 0) + actualDx + 'px';
            this._element.style.width = newWidth + 'px';
            this._element.style.height = newHeight + 'px';
        }
        const onResizeEnd = (dragAssistant:DragAssistant<A>):void => //handle end of drag handle resizing
        {
            if (dragAssistant.element.classList.contains('right')) this.#handleStickyEdge(Edge.RIGHT);
            if (dragAssistant.element.classList.contains('bottom')) this.#handleStickyEdge(Edge.BOTTOM);
            if (dragAssistant.element.classList.contains('left')) this.#handleStickyEdge(Edge.LEFT);
            if (dragAssistant.element.classList.contains('top')) this.#handleStickyEdge(Edge.TOP);
            if (dragAssistant.element.classList.contains('top-right')) 
            {
                this.#handleStickyEdge(Edge.RIGHT);
                this.#handleStickyEdge(Edge.TOP);
            }
            if (dragAssistant.element.classList.contains('top-left'))
            {
                this.#handleStickyEdge(Edge.LEFT);
                this.#handleStickyEdge(Edge.TOP);
            }
            if (dragAssistant.element.classList.contains('bottom-right'))
            {
                this.#handleStickyEdge(Edge.RIGHT);
                this.#handleStickyEdge(Edge.BOTTOM);
            }
            if (dragAssistant.element.classList.contains('bottom-left'))
            {
                this.#handleStickyEdge(Edge.LEFT);
                this.#handleStickyEdge(Edge.BOTTOM);
            }

            let state = this._displayState;
            if (state.value === DisplayState.MAXIMIZED) 
            {
                state.value = DisplayState.NORMAL; //they resized while maximized, so set the state to normal
                this._preferredDimensions.value[state.value].top = parseInt(this._element.style.top, 10) || 0;
                this._preferredDimensions.value[state.value].left = parseInt(this._element.style.left, 10) || 0;
                this._preferredDimensions.value[state.value].width = parseInt(this._element.style.width, 10) || 0;
                this._preferredDimensions.value[state.value].height = parseInt(this._element.style.height, 10) || 0;
            }
            this.#displayState(state.value, false);

            this._groupStore.commit();
        }

        this._elements.resizeHandles.forEach((element:HTMLElement) => new DragAssistant(this._app, this, element, () => {}, 
        () => 
        {
            return {momentum:{multiplier:80, threshold:30, max:Math.max(window.innerHeight, window.innerWidth), duration:500, ease:easeOutQuad}};
        }, onResize, onResizeEnd, 5)); //create drag assistants for each resize handle
    }

    private _resizeTimeout:number | undefined;
    public async onResizeListened(event:Event):Promise<void>
    {
        clearTimeout(this._resizeTimeout); //clear the timeout if it's already set

        this.moveWithinParentBounds(undefined, false);
        
        this._resizeTimeout = window.setTimeout(() =>
        {
            this.moveWithinParentBounds(undefined, false); //i don't think i should need this, but when maximizing and then minimizing the browser window there is a resizing problem unless i do this
        
            this._resizeTimeout = undefined;
        }, 250);
    }

    private _isMouseInside:boolean = false;
    #initButtons():void
    {
        const elements = this._elements;
        const eventListenerAssistant = this._eventListenerAssistant;

        //button container hide/show animate functionality
        eventListenerAssistant.subscribe(this._element, 'pointerenter', () =>
        {
            this._isMouseInside = true;
            
            const currentStyle = elements.buttonContainer.style.width;
            elements.buttonContainer.style.width = 'auto';
            const toWidth = elements.buttonContainer.offsetWidth;
            elements.buttonContainer.style.width = currentStyle;

            const target = {width:elements.buttonContainer.offsetWidth};
            TweenAssistant.to(this._app, {width:toWidth}, {target:target, duration:300, onUpdate:() => 
            {
                elements.buttonContainer.style.width = target.width + 'px';
            }});
        });

        eventListenerAssistant.subscribe(this._element, 'pointerleave', () =>
        {
            this._isMouseInside = false;
            if (this.focused) return; //abort hide if focused
            
            setTimeout(() => 
            {
                if (this._isMouseInside) return; 
                
                const target = {width:elements.buttonContainer.offsetWidth};
                TweenAssistant.to(this._app, {width:0}, {target:target, duration:300, onUpdate:() => 
                {
                    elements.buttonContainer.style.width = target.width + 'px';
                }});
            }, 150);
        });

        eventListenerAssistant.subscribe(elements.minimizeButton, 'click', () =>
        {
            if (this._displayState.value === DisplayState.MAXIMIZED) this.#displayState(DisplayState.NORMAL, false);
            else this.#displayState(DisplayState.MINIMIZED, false);
        });

        //setup maximize button
        eventListenerAssistant.subscribe(elements.maximizeButton, 'click', () =>
        {
            if (this._displayState.value === DisplayState.MINIMIZED) this.#displayState(DisplayState.NORMAL, false);
            else this.#displayState(DisplayState.MAXIMIZED, false);
        });

        //setup close button
        eventListenerAssistant.subscribe(elements.closeButton, 'click', async () =>
        {
            await this.#getParent().windowManager.closeWindow(this);
        });
    }

    public override async ready():Promise<void>
    {
        await super.ready();

        this._app.globalListenerManager.subscribe(this, GlobalEvent.Resize, (event:Event) => this.onResizeListened(event));

        this._element.style.visibility = 'visible';
    }

    public override async onShow(initial:boolean):Promise<void>
    {
        this.#displayState(this._displayState.value, false, initial);
    }
    
    public onFocus(focused:boolean):void
    {
        const elements = this._elements;

        if (focused) elements.windowHeader.classList.add('focused');
        else elements.windowHeader.classList.remove('focused'); 

        if (focused) 
        {
            const currentStyle = elements.buttonContainer.style.width;
            elements.buttonContainer.style.width = 'auto';
            const toWidth = elements.buttonContainer.offsetWidth;
            elements.buttonContainer.style.width = currentStyle;

            const target = {width:elements.buttonContainer.offsetWidth};
            TweenAssistant.to(this._app, {width:toWidth}, {target:target, duration:300, onUpdate:() => 
            {
                elements.buttonContainer.style.width = target.width + 'px';
            }});
        }
        else
        {
            if (this._isMouseInside) 
            {
                const currentStyle = elements.buttonContainer.style.width;
                elements.buttonContainer.style.width = 'auto';
                const toWidth = elements.buttonContainer.offsetWidth;
                elements.buttonContainer.style.width = currentStyle;
    
                const target = {width:elements.buttonContainer.offsetWidth};
                TweenAssistant.to(this._app, {width:toWidth}, {target:target, duration:300, onUpdate:() => 
                {
                    elements.buttonContainer.style.width = target.width + 'px';
                }});
            }
            else 
            {
                const target = {width:elements.buttonContainer.offsetWidth};
                TweenAssistant.to(this._app, {width:0}, {target:target, duration:300, onUpdate:() => 
                {
                    elements.buttonContainer.style.width = target.width + 'px';
                }});
            }
        }
    }

    public get focused():boolean
    {
        return this.#getParent().windowManager.getFocusedWindow() === this;
    }

    public set title(title:string)
    {
        this._elements.windowTitle.innerHTML = title;
    }

    /**
     * Handles the sticky edge on the right side of the window.
     * Sticky egdges are not particularlly necessary, but they are a nice feature that makes it easier to align windows if one is resizing the app often.
     * If the user drags the window past the edge of the parent window, it will stick to the edge.
     * @param edge - The edge to handle (right, bottom, left, top).
     * @param force - Whether to force the sticky edge behavior.
     * @throws Error if the window parent does not implement the IWindowable interface.
     */
    #handleStickyEdge(edge:Edge, force:boolean=false) 
    {
        const parentBounds = this.#getParentBounds();
        let condition = false;
    
        switch (edge) 
        {
            case Edge.RIGHT:
                condition = (parentBounds.right - (this._element.offsetWidth + this._element.offsetLeft)) <= STICKY_THRESHOLD;
                break;
            case Edge.BOTTOM:
                condition = (parentBounds.bottom - (this._element.offsetHeight + this._element.offsetTop)) <= STICKY_THRESHOLD;
                break;
            case Edge.LEFT:
                condition = (this._element.offsetLeft - parentBounds.left) <= STICKY_THRESHOLD;
                break;
            case Edge.TOP:
                condition = (this._element.offsetTop - parentBounds.top) <= STICKY_THRESHOLD;
                break;
        }
    
        this._stickyEdges.value[edge] = force || condition;
    
        const handle = this._elements.resizeHandles.find((element: HTMLElement) => element.classList.contains(edge))!;
    
        if (this._displayState.value === DisplayState.MINIMIZED) 
        {
            this._stickyEdges.value[edge] = false;
            handle.classList.remove(`sticky-${edge}`);
            return;
        }
    
        //apply or remove the classes based on the sticky edge conditions
        this._stickyEdges.value[edge] ? handle.classList.add(`sticky-${edge}`) : handle.classList.remove(`sticky-${edge}`);
    }
    
    /**
     * Moves the element within the bounds of its parent, optionally applying preferred dimensions.
     * If the dimensions exceed the parent's bounds, they are constrained to fit.
     * @param preferredDimensions - Optional preferred dimensions for the window.
     * @param noTween - Optional flag to disable the tween animation.
     * @returns A Promise that resolves when the window has been moved.
     * @throws An error if the parent element does not implement the IWindowable interface.
     */
    public async moveWithinParentBounds(preferredDimensions?:IWindowDimensions, noTween?:boolean):Promise<void> 
    {
        const minimized = this._displayState.value === DisplayState.MINIMIZED;

        const parentElement = this._element.parentNode as HTMLElement;
        
        const parentBounds = this.#getParentBounds();

        const minY = parentBounds.top;
        const minX = parentBounds.left;
        const maxX = parentBounds.right;
        const maxY = parentBounds.bottom;
    
        preferredDimensions = preferredDimensions || this._preferredDimensions.value[this._displayState.value];

        let initialTop = preferredDimensions && preferredDimensions.top !== undefined ? preferredDimensions.top : this._element.offsetTop;
        let initialLeft = preferredDimensions && preferredDimensions.left !== undefined ? preferredDimensions.left : this._element.offsetLeft;
        let initialWidth = preferredDimensions && preferredDimensions.width !== undefined ? preferredDimensions.width : this._element.offsetWidth;
        let initialHeight = preferredDimensions && preferredDimensions.height !== undefined ? preferredDimensions.height : this._element.offsetHeight;
    
        //a minimized window can be smaller than the minimum width and height
        if (!minimized) initialWidth = Math.max(this.minWidth, initialWidth);
        if (!minimized) initialHeight = Math.max(this.minHeight, initialHeight);

        //no sticky support for minimized windows
        if (!minimized && this._stickyEdges.value.top) initialTop = minY;
        if (!minimized && this._stickyEdges.value.bottom) initialTop = maxY - initialHeight;
        if (!minimized && this._stickyEdges.value.left) initialLeft = minX;
        if (!minimized && this._stickyEdges.value.right) initialLeft = maxX - initialWidth;
        if (!minimized && this._stickyEdges.value.top && this._stickyEdges.value.bottom) initialHeight = maxY - minY;
        if (!minimized && this._stickyEdges.value.left && this._stickyEdges.value.right) initialWidth = maxX - minX;

        //calculate the maximum allowed width and height
        const maxAllowedWidth = maxX - minX;
        const maxAllowedHeight = maxY - minY;
    
        //update width and height if they are out of bounds
        if (initialWidth > maxAllowedWidth) initialWidth = maxAllowedWidth;
        if (initialHeight > maxAllowedHeight) initialHeight = maxAllowedHeight;
    
        //recalculate bounds after possible resizing
        const boundX = maxX - initialWidth;
        const boundY = maxY - initialHeight;
    
        let x = Math.min(boundX, Math.max(minX, initialLeft));
        let y = Math.min(boundY, Math.max(minY, initialTop));

        if (this._displayState.value === DisplayState.MAXIMIZED || this._singleWindowMode)
        {
            x = parentElement.offsetLeft;
            y = parentElement.offsetTop;
            initialWidth = parentElement.offsetWidth;
            initialHeight = parentElement.offsetHeight;
        }

        if (noTween || this._singleWindowMode)
        {
            this._element.style.left = x + 'px';
            this._element.style.top = y + 'px';
            this._element.style.width = initialWidth + 'px';
            this._element.style.height = initialHeight + 'px';
            return;
        }

        //tween back to bounds
        return new Promise<void>((resolve) => 
        {
            const distance = (x1:number, y1:number, x2:number, y2:number) => Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            
            const fixedRate = 1125; //1125 pixels per second
            
            //calculate current x and y
            const currentX = parseFloat(this._element.style.left || '0');
            const currentY = parseFloat(this._element.style.top || '0');
            
            //calculate the distance to the new x and y
            const dist = distance(currentX, currentY, x, y);
            
            //calculate the time required at the fixed rate
            let timeRequired = dist / fixedRate;

            if (timeRequired < .4) timeRequired = .4; //tweening too fast is ugly

            const element = this._element;
            const target = {left:currentX, top:currentY, width:this._element.offsetWidth, height:this._element.offsetHeight};
            TweenAssistant.to(this._app, {left:x, top:y, width:initialWidth, height:initialHeight}, {target:target, duration:timeRequired * 1000, ease:easeOutQuad, onUpdate:() =>
            {
                element.style.left = target.left + 'px';
                element.style.top = target.top + 'px';
                element.style.width = target.width + 'px';
                element.style.height = target.height + 'px';
            },
            onComplete:resolve});
        });
    }
    
    /**
     * Redraws the window in the specified state.
     * @param noTween If true, the window will be redrawn without animation.
     */
    async #displayState(state:DisplayState, noTween:boolean=false, isInitialShow:boolean=false):Promise<void>
    {
        const elements = this._elements;
        const fromState = this._displayState.value;
        this._displayState.value = state;
        await this._groupStore.commit();

        if (fromState === DisplayState.MINIMIZED) elements.resizeHandles.forEach((element:HTMLElement) => element.style.display = 'block'); //undo the hiding of resize handles when minimized
        if (fromState === DisplayState.MAXIMIZED)
        {
            elements.windowTitle.classList.remove('title-maximized');
            elements.windowTitle.classList.add('title');
        }

        if (this._singleWindowMode)
        {
            elements.resizeHandles.forEach((element:HTMLElement) => element.style.display = 'none'); //hide resize handles when full screen
            elements.windowHeader.style.display = 'none'; //hide header when in own window

            await this.moveWithinParentBounds(undefined, true);
            return;
        }

        switch(state)
        {
            case DisplayState.MINIMIZED:
                elements.windowContent.style.display = 'none';
                
                elements.resizeHandles.forEach((element:HTMLElement) => element.style.display = 'none');
    
                //store current width and height
                const currentWidth = this._element.style.width;
                const currentHeight = this._element.style.height;
    
                //set to auto
                this._element.style.width = 'auto';
                this._element.style.height = 'auto';
                
                //get computed styles
                const autoWidth = parseFloat(getComputedStyle(this._element).width) || undefined;
                const autoHeight = parseFloat(getComputedStyle(this._element).height) || undefined;
                
                elements.windowContent.style.display = 'block';
    
                //restore original styles, so we can tween
                if (!isInitialShow) //we do not want to tween the width/height on initial show for minimized windows, but this could change if we make minimized windows have a width/height in the future
                {
                    this._element.style.width = currentWidth;
                    this._element.style.height = currentHeight;
                }
                let preferredDimensions = this._preferredDimensions.value[state];

                //if the preferred dimensions are undefined, use the normal state dimensions
                let top:number | undefined = preferredDimensions.top !== undefined ? preferredDimensions.top : this._preferredDimensions.value[DisplayState.NORMAL].top;
                let left:number | undefined = preferredDimensions.left !== undefined ? preferredDimensions.left : this._preferredDimensions.value[DisplayState.NORMAL].left;

                await this.moveWithinParentBounds({top:top, left:left, width:autoWidth, height:autoHeight}, noTween);
                break;
            case DisplayState.NORMAL:
                await this.moveWithinParentBounds(undefined, noTween);
                break;
            case DisplayState.MAXIMIZED:
                elements.windowTitle.classList.add('title-maximized');
                elements.windowTitle.classList.remove('title');

                await this.moveWithinParentBounds(undefined, noTween);
                break;
        }
    }

    #getParent():IWindowable<A>
    {
        let  parentElement = this._element.parentElement;
        while (parentElement)
        {
            if (parentElement.component && this._app.typeUtil.is<IWindowable<A>>(parentElement.component, IWindowableType)) return parentElement.component;

            parentElement = parentElement.parentElement;
        }
        
        throw new Error('Window parent does not implement IWindowable interface');
    }

    /**
     * Returns the bounds of the parent element of the window.
     * @returns An object containing the left, top, right, and bottom bounds of the parent element.
     * @throws An error if the parent element does not implement the IWindowable interface.
     */
    #getParentBounds():{left:number, top:number, right:number, bottom:number}
    {
        return this.#getParent().getBounds();
    }

    public async onTransferedToOwnWindow():Promise<boolean>
    {
        if (this._transferedToOwnWindow)
        {
            this.warn('onTransferedToOwnWindow() called more than once');
            return false;
        }
        this._transferedToOwnWindow = true;

        this._element.style.visibility = 'hidden';
        this._element.style.display = 'none';

        return true;
    }

    public async onTransferedBackToParentWindow():Promise<boolean>
    {
        if (!this._transferedToOwnWindow)
        {
            this.warn('onTransferedBackToParentWindow() called before Window.onTransferedToOwnWindow()');
            return false;
        }
        this._transferedToOwnWindow = false;

        this._element.style.display = 'block';
        this._element.style.visibility = 'visible';

        await this.#displayState(this._displayState.value, false);

        return true;
    }

    public get isTransferedToOwnWindow():boolean
    {
        return this._transferedToOwnWindow;  
    }

    public abstract get appName():string;

    public get appID():string
    {
        return this._appID;
    }

    public get windowID():string
    {
        return this._windowID;
    }

    public get minWidth():number
    {
        return 450;
    }

    public get minHeight():number
    {
        return 400;
    }

    public get isTransferable():boolean
    {
        return false;
    }

    public onContextMenu(event:MouseEvent):IContextMenuData | undefined
    {
        return undefined;
    }

    protected override get _elements():WindowElements { return this.__elements ?? (this.__elements = new WindowElements()); }
}
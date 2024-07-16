/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { GlobalEvent } from "../../library/managers/GlobalListenerManager.ts";
import type { IBaseApp } from "../../library/IBaseApp.ts";
import { TweenAssistant, easeOutQuad, type Tween } from "../../library/assistants/TweenAssistant.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { EventListenerAssistant } from "../../library/assistants/EventListenerAssistant.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";

type DragStartReturnProps = {momentum:{multiplier:number, threshold:number, max:number, duration:number, ease:((t:number, b:number, c:number, d:number, params?:any) => number) | undefined}};

export class DragAssistant<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private _dragging = false;
    private _startX = 0;
    private _startY = 0;
    private _lastX = 0;
    private _lastY = 0;

    private _element:HTMLElement;
    private _onDown:(dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number) => void | false;
    private _onDragStart:(dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number) => DragStartReturnProps | void;
    private _onDrag:(dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, xDelta:number, yDelta:number, currentX:number, currentY:number) => void
    private _onDragEnd:(dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, endX:number, endY:number) => void;

    private _thresholdStartEvent:PointerEvent | undefined;
    private _preThresholdXDelta = 0;
    private _preThresholdYDelta = 0;
    private _dragThreshold:number; //how many pixels the mouse must move before drag is triggered

    private _mouseIsDown = false; //prevents adding double event listeners

    private _dragStartProps:DragStartReturnProps | undefined;

    private readonly N = 6; //number of last move events to consider
    private _velocityXs!:number[];
    private _velocityYs!:number[];
    private _currentIndex = 0;   
    private _count = 0;
    private _lastTimeStamp = 0; 

    private _tween?:Tween;

    private _eventListenerAssistant:EventListenerAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, onDown:(dragAssistant:DragAssistant<A>, event:PointerEvent) => void | false, onDragStart:(dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number) => DragStartReturnProps | void, onDrag:(dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, deltaX:number, deltaY:number, currentX:number, currentY:number) => void, onDragEnd:(dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, endX:number, endY:number) => void, dragThreshold=0) 
    {
        super(app, destructor);

        this._element = element;
        this._onDown = onDown;
        this._onDragStart = onDragStart;
        this._onDrag = onDrag;
        this._onDragEnd = onDragEnd;
        
        this._dragThreshold = dragThreshold;

        this._eventListenerAssistant = new EventListenerAssistant(app, this);
        this._eventListenerAssistant.subscribe(element, 'pointerdown', this.#onDragStart, {capture:true});
    }

    #onDragStart = (event:PointerEvent):void =>
    {
        if (event.buttons !== 1) return; //ignore if not left button

        if (this._mouseIsDown === true) 
        {
            this.warn('onDragStart', 'mouse is already down');
            
            this.onUpListened(event, true); //if mouse is already down, call onUp to reset everything
        }    
        this._mouseIsDown = true;

        const startX = this._startX = this._lastX = event.clientX;
        const startY = this._startY = this._lastY = event.clientY;
        
        const result = this._onDown(this, event, startX, startY);
        if (result === false) 
        {
            this._mouseIsDown = false;
            return; //if onDown returns false, don't start dragging
        }

        document.body.classList.add('no-user-select');

        this._velocityXs = new Array(this.N).fill(0);
        this._velocityYs = new Array(this.N).fill(0);
        this._currentIndex = 0;   
        this._count = 0;
        this._lastTimeStamp = event.timeStamp;
        
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Move, this.onMoveListened);
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Up, this.onUpListened);

        if (this._dragThreshold > 0) 
        {
            this._thresholdStartEvent = event; //save so we can pass it to the drag start callback in #onDragMove
            return;
        }

        this._dragging = true;
        this._dragStartProps = this._onDragStart(this, event, startX, startY) || undefined;
    }

    public onMoveListened = (event:PointerEvent):void =>
    {
        const deltaX = event.clientX - this._lastX;
        const deltaY = event.clientY - this._lastY;

        const currentTimeStamp = event.timeStamp;
        const deltaTime = currentTimeStamp - this._lastTimeStamp;
        this._lastTimeStamp = currentTimeStamp;

        const velocityX = deltaX / deltaTime;
        const velocityY = deltaY / deltaTime;

        //update the current index's value and then increment the index
        this._velocityXs[this._currentIndex] = velocityX;
        this._velocityYs[this._currentIndex] = velocityY;
        this._currentIndex = (this._currentIndex + 1) % this.N;
        this._count = Math.min(this._count + 1, this.N);

        const startX = this._startX;
        const startY = this._startY;

        this._lastX = event.clientX;
        this._lastY = event.clientY;

        if (this._dragging === false && this._dragThreshold > 0)
        {
            this._preThresholdXDelta += deltaX; //update cumulative delta
            this._preThresholdYDelta += deltaY; //update cumulative delta

            const distance = Math.sqrt(this._preThresholdXDelta * this._preThresholdXDelta + this._preThresholdYDelta * this._preThresholdYDelta);
            if (distance < this._dragThreshold) return; //ignore if under threshold
            
            this._dragging = true;
            this._dragStartProps = this._onDragStart(this, this._thresholdStartEvent!, startX, startY) ?? undefined;
            
            this._onDrag(this, event, startX, startY, this._preThresholdXDelta, this._preThresholdYDelta, event.clientX, event.clientY);
            return;
        }

        this._onDrag(this, event, startX, startY, deltaX, deltaY, event.clientX, event.clientY);
    }

    public onUpListened = (event:PointerEvent | undefined, noMomentum:boolean=false):void =>
    {
        this._mouseIsDown = false;

        const startX = this._startX;
        const startY = this._startY;

        const count = this._count;
        if (count === 0) noMomentum = true; //if we didn't move, don't do momentum

        this._app.globalListenerManager.unsubscribe(this, GlobalEvent.Move, this.onMoveListened);
        this._app.globalListenerManager.unsubscribe(this, GlobalEvent.Up, this.onUpListened);

        document.body.classList.remove('no-user-select');

        if (this._tween !== undefined) this._tween.abort();

        this._preThresholdXDelta = 0; //reset cumulative delta
        this._preThresholdYDelta = 0; //reset cumulative delta
        this._thresholdStartEvent = undefined;

        if (this._dragging === false) return; //only call onDragEnd if we were dragging
        this._dragging = false;

        if (event === undefined) return; //todo, maybe have a this._onDragCancel callback?

        const momentum = this._dragStartProps?.momentum;
        if (momentum === undefined) return this._onDragEnd(this, event, startX, startY, event.clientX, event.clientY); //if no momentum, just call onDragEnd

        const avgVelocityX = this._velocityXs.reduce((a, b) => a + b, 0) / count;
        const avgVelocityY = this._velocityYs.reduce((a, b) => a + b, 0) / count;

        let targetX = avgVelocityX * momentum.multiplier;
        let targetY = avgVelocityY * momentum.multiplier;

        if (targetX > momentum.max) targetX = momentum.max;
        if (targetY > momentum.max) targetY = momentum.max;
        if (targetX < -momentum.max) targetX = -momentum.max;
        if (targetY < -momentum.max) targetY = -momentum.max;

        noMomentum = noMomentum || momentum.duration === 0 || (Math.abs(targetX) < momentum.threshold && Math.abs(targetY) < momentum.threshold);
        if (noMomentum === true) return this._onDragEnd(this, event, startX, startY, event.clientX, event.clientY); //if no momentum, just call onDragEnd

        const target = {x:0, y:0, previousX:0, previousY:0};
        TweenAssistant.to(this._app, {x:targetX, y:targetY}, {target, duration:momentum.duration, ease:momentum.ease ?? easeOutQuad, onUpdate:() =>
        {
            const diffX = target.x - target.previousX;
            const diffY = target.y - target.previousY;

            this._onDrag(this, event, startX, startY, diffX, diffY, event.clientX + target.x, event.clientY + target.y);

            target.previousX = target.x;
            target.previousY = target.y;
        }, onComplete:() => 
        {
            this._onDragEnd(this, event, startX, startY, event.clientX + target.x, event.clientY + target.y);
        }});
    }

    public get element():HTMLElement { return this._element; }
    
    public override async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        if (this._mouseIsDown === true) this.onUpListened(undefined, true); //if mouse is already down, call onUp to reset everything

        return true;
    }
}
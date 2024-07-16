/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { ISignal } from "../../../../../../../shared/src/library/signal/ISignal";
import { Signal } from "../../../../../../../shared/src/library/signal/Signal";
import { GlobalEvent } from "../../managers/GlobalListenerManager";
import type { IBaseApp } from "../../IBaseApp";
import { Component } from "../Component";
import { ComponentDecorator } from "../../decorators/ComponentDecorator";
import html from "./VScrollBar.html";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { EventListenerAssistant } from "../../assistants/EventListenerAssistant";

const WIDTH = 18;
const MIN_THUMB_HEIGHT = 25;

class Elements
{
    track!:HTMLElement;
    thumb!:HTMLElement;
}

@ComponentDecorator()
export class VScrollBar<A extends IBaseApp<A>> extends Component<A>
{ 
    private _pageSize:number = 0;

    private _scrollPosition:number = 0;
    private _minScrollPosition:number = 0;
    private _maxScrollPosition:number = 0;

    private _initialPageY:number = 0;

    private _thumbHeight:number = 0;
    private _thumbY:number = 0;

    private _onScrollSignal = new Signal<[VScrollBar<A>, number, string]>(this);

    private _eventListenerAssistant!:EventListenerAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init(...args:any):Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._eventListenerAssistant = new EventListenerAssistant(this._app, this);
        
        this._eventListenerAssistant.subscribe(elements.track, 'click', this.onTrackClick);
        this._eventListenerAssistant.subscribe(elements.thumb, 'pointerdown', this.onThumbMouseDown);

        this._element.style.width = WIDTH + 'px';
        
        elements.track.style.backgroundColor = 'var(--bs-secondary-bg)';
        elements.track.style.width = WIDTH + 'px';
        
        elements.thumb.style.backgroundColor = '#666666';
        elements.thumb.style.width = (WIDTH - 10) + 'px';
        elements.thumb.style.marginLeft = '4px';
        elements.thumb.style.borderRadius = '10px';
        
        return super.init();
    }

    private onTrackClick = (event:MouseEvent):void => 
    {
        const clickY = event.offsetY;

        //existing track and thumb properties
        const trackHeight = this.height;
        const thumbHeight = this._thumbHeight;
        const maxScroll = this._maxScrollPosition;
        const minScroll = this._minScrollPosition;
    
        //calculate the total scrollable area
        const totalScrollableArea = maxScroll - minScroll;

        //calculate the unbounded new scroll position
        let newScrollPosition = (((clickY - thumbHeight / 2) / (trackHeight - thumbHeight)) * totalScrollableArea) || 0;

        //clamp the new scroll position between the min and max scroll positions
        newScrollPosition = Math.min(maxScroll, Math.max(minScroll, newScrollPosition));
        
        //update your actual scroll position and thumb here based on newScrollPosition
        let delta: number = newScrollPosition - this._scrollPosition;
        let direction: string = newScrollPosition > this._scrollPosition ? "down" : "up";

        //assuming you have a method to recalculate the thumb's position based on the new scroll position
        this._onScrollSignal.dispatch(this, delta, direction);
    }
    
    private onThumbMouseDown = (event:MouseEvent):void => 
    {
        this._initialPageY = event.pageY;

        const globalListenerManager = this._app.globalListenerManager;
        if (globalListenerManager.subscribed(this, GlobalEvent.Move, this.onMoveListened) === false) globalListenerManager.subscribe(this, GlobalEvent.Move, this.onMoveListened);
        if (globalListenerManager.subscribed(this, GlobalEvent.Up, this.onUpListened) === false) globalListenerManager.subscribe(this, GlobalEvent.Up, this.onUpListened);
    }
    
    public onMoveListened = (event:PointerEvent):void => 
    {
        const trackHeight = this.height - this._thumbHeight;
        let oldPosition = this._scrollPosition;
        const deltaY = event.pageY - this._initialPageY;
        this._initialPageY = event.pageY;
        let newPosition = Math.max(this._minScrollPosition, ((this._thumbY + deltaY) / trackHeight * this._maxScrollPosition || 0));
        
        //if the new position is greater than or equal to the max scroll position and the current scroll position is already at the max scroll position, return
        if (newPosition >= this._maxScrollPosition && this._scrollPosition >= this.maxScrollPosition) return;
        
        //if the new position is less than or equal to the min scroll position and the current scroll position is already at the min scroll position, return
        if (newPosition <= this._minScrollPosition && this._scrollPosition <= this._minScrollPosition) return;
        if (newPosition === this._scrollPosition) return;

        const scrollPosition = Math.min(this._maxScrollPosition, Math.max(this._minScrollPosition, newPosition));

        let direction = scrollPosition > oldPosition ? "down" : "up";
        let delta = scrollPosition - oldPosition;

        this._onScrollSignal.dispatch(this, delta, direction);
    }

    public onUpListened = (event:PointerEvent):void => 
    {
        const globalListenerManager = this._app.globalListenerManager;
        globalListenerManager.unsubscribe(this, GlobalEvent.Move, this.onMoveListened);
        globalListenerManager.unsubscribe(this, GlobalEvent.Up, this.onUpListened);
    }

    private calcThumb() 
    {
        //calculate the total scrollable area
        var totalScrollableArea:number = this._maxScrollPosition - this._minScrollPosition;
        
        //dynamic track height if it can change with the grid size
        var trackHeight:number = this._pageSize;
    
        //calculate the thumb size based on the current state
        var newThumbHeight:number = Math.max(((this._pageSize / (this._maxScrollPosition + this._pageSize)) * trackHeight) || 0, MIN_THUMB_HEIGHT);
        this._thumbHeight = newThumbHeight;

        //calculate thumb's new position based on scroll position
        var thumbPositionRatio:number = ((this._scrollPosition - this._minScrollPosition) / totalScrollableArea) || 0;
        var newThumbY:number = thumbPositionRatio * (trackHeight - newThumbHeight);
    
        //update thumb position
        this._thumbY = newThumbY;
    }

    private redraw():void 
    {         
        this.calcThumb();

        const elements = this._elements;

        this._element.style.height = this._pageSize + 'px';
        
        elements.track.style.height = this._pageSize + 'px';

        elements.thumb.style.height = this._thumbHeight + 'px';
        elements.thumb.style.top = Math.round(this._thumbY) + 'px';

        if (this._pageSize <= Math.floor(this._thumbHeight)) this._element.style.visibility = 'hidden';
        else this._element.style.visibility = 'visible';
    }

    public setScrollProperties(pageSize:number, scrollPosition:number, minScrollPosition:number, maxScrollPosition:number):void 
    {
        if (pageSize < 0 || scrollPosition < 0 || minScrollPosition < 0 || maxScrollPosition < 0) throw new Error("Scroll properties cannot be negative.");
      
        this._pageSize = pageSize;
        this._minScrollPosition = minScrollPosition;
        this._scrollPosition = scrollPosition;
        this._maxScrollPosition = maxScrollPosition;
    
        this.redraw(); //update track and thumb after properties have been set
    }

    public get onScrollSignal():ISignal<[VScrollBar<A>, number, string]>
    {
        return this._onScrollSignal;
    }

    public get width():number
    {
        return WIDTH;
    }

    public get height():number
    {
        return this._pageSize;
    }

    public get scrollPosition():number 
    {
        return this._scrollPosition;
    }

    public get maxScrollPosition():number 
    {
        return this._maxScrollPosition; 
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
import type { ISignal } from "../../../../../../../shared/src/library/signal/ISignal";
import { Signal } from "../../../../../../../shared/src/library/signal/Signal";
import { GlobalEvent } from "../../managers/GlobalListenerManager";
import type { IBaseApp } from "../../IBaseApp";
import { Component } from "../Component";
import { ComponentDecorator } from "../../decorators/ComponentDecorator";
import html from "./HScrollBar.html";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { EventListenerAssistant } from "../../assistants/EventListenerAssistant";

const HEIGHT = 18; //the height of the horizontal scrollbar
const MIN_THUMB_WIDTH = 25; //the minimum width of the thumb

class Elements
{
    track!:HTMLElement;
    thumb!:HTMLElement;
}

@ComponentDecorator()
export class HScrollBar<A extends IBaseApp<A>> extends Component<A>
{
    private _pageWidth:number = 0;

    private _scrollX:number = 0;
    private _minScrollX:number = 0;
    private _maxScrollX:number = 0;

    private _initialPageX:number = 0;

    private _thumbWidth:number = 0;
    private _thumbX:number = 0;

    private _onScrollSignal = new Signal<[HScrollBar<A>, number, string]>(this);

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

        elements.track.style.backgroundColor = 'var(--bs-secondary-bg)';
        elements.track.style.height = HEIGHT + 'px';

        elements.thumb.style.backgroundColor = '#666666';
        elements.thumb.style.height = HEIGHT + 'px';
        elements.thumb.style.borderRadius = '10px';

        return super.init();
    }

    private onTrackClick = (event:MouseEvent): void => 
    {
        const clickX = event.offsetX;
        
        const trackWidth = this.width;
        const thumbWidth = this._thumbWidth;
        const maxScroll = this._maxScrollX;
        const minScroll = this._minScrollX;

        let newScrollX = (((clickX - thumbWidth / 2) / (trackWidth - thumbWidth)) * (maxScroll - minScroll) || 0);
        newScrollX = Math.min(maxScroll, Math.max(minScroll, newScrollX));

        let delta = newScrollX - this._scrollX;
        let direction = newScrollX > this._scrollX ? "right" : "left";

        this._onScrollSignal.dispatch(this, delta, direction);
    }
    
    private onThumbMouseDown = (event:MouseEvent):void => 
    {
        this._initialPageX = event.pageX;
        
        const globalObserver = this._app.globalListenerManager;
        if (globalObserver.subscribed(this, GlobalEvent.Move, this.onMoveListened) === false) globalObserver.subscribe(this, GlobalEvent.Move, this.onMoveListened);
        if (globalObserver.subscribed(this, GlobalEvent.Up, this.onUpListened) === false) globalObserver.subscribe(this, GlobalEvent.Up, this.onUpListened);
    }

    public onMoveListened = (event:PointerEvent):void => 
    {
        const trackWidth = this.width - this._thumbWidth;
        const deltaX = event.pageX - this._initialPageX;
        this._initialPageX = event.pageX;
        let newPosition = Math.max(this._minScrollX, ((this._thumbX + deltaX) / trackWidth * this._maxScrollX) || 0);

        //if the new position is greater than or equal to the max scroll position and the current scroll position is already at the max scroll position, return
        if (newPosition >= this._maxScrollX && this._scrollX >= this.maxScrollX) return;
        
        //if the new position is less than or equal to the min scroll position and the current scroll position is already at the min scroll position, return
        if (newPosition <= this._minScrollX && this._scrollX <= this._minScrollX) return;

        if (newPosition === this._scrollX) return;

        let oldPosition = this._scrollX;
        let scrollX = Math.min(this._maxScrollX, Math.max(0, newPosition));

        let direction = scrollX > oldPosition ? "right" : "left";
        let delta = scrollX - oldPosition;

        this._onScrollSignal.dispatch(this, delta, direction);
    }

    public onUpListened = (event:PointerEvent): void => 
    {
        const globalObserver = this._app.globalListenerManager;
        globalObserver.unsubscribe(this, GlobalEvent.Move, this.onMoveListened);
        globalObserver.unsubscribe(this, GlobalEvent.Up, this.onUpListened);
    }

    private calcThumb() 
    {
        const totalScrollableArea = this._maxScrollX - this._minScrollX;
        const trackWidth = this._pageWidth;
    
        const newThumbWidth = Math.max(((this._pageWidth / (this._maxScrollX + this._pageWidth)) * trackWidth) || 0, MIN_THUMB_WIDTH);
        this._thumbWidth = newThumbWidth;
    
        const thumbPositionRatio = ((this._scrollX - this._minScrollX) / totalScrollableArea) || 0;
        const newThumbX = thumbPositionRatio * (trackWidth - newThumbWidth);
    
        this._thumbX = newThumbX;
    }

    private redraw(): void 
    {         
        this.calcThumb();
        
        const elements = this._elements;

        elements.track.style.width = this._pageWidth + 'px';
        elements.thumb.style.width = this._thumbWidth + 'px';

        elements.thumb.style.left = Math.round(this._thumbX) + 'px';
    }
    
    public setScrollProperties(pageWidth:number, scrollX:number, minScrollX:number, maxScrollX:number):void 
    {
        if (pageWidth < 0 || scrollX < 0 || minScrollX < 0 || maxScrollX < 0) throw new Error("Scroll properties cannot be negative.");
      
        this._pageWidth = pageWidth;
        this._minScrollX = minScrollX;
        this._scrollX = scrollX;
        this._maxScrollX = maxScrollX;
    
        this.redraw(); //update track and thumb after properties have been set
    }

    public get onScrollSignal():ISignal<[HScrollBar<A>, number, string]> 
    {
        return this._onScrollSignal;
    }

    public get scrollX():number 
    {
        return this._scrollX;
    }

    public get maxScrollX():number 
    {
        return this._maxScrollX; 
    }

    public get width():number
    {
        return this._pageWidth;
    }

    public get height():number
    {
        return HEIGHT;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}

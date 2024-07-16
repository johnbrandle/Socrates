/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Signal } from "../../../../../../../shared/src/library/signal/Signal";
import type { ITile } from "./ITile";
import { ITileType } from "./ITile";
import type { ITileData } from "./ITileData";
import { Component } from "../Component";
import type { IBaseApp } from "../../IBaseApp";
import { ComponentDecorator } from "../../decorators/ComponentDecorator";
import { EventListenerAssistant } from "../../assistants/EventListenerAssistant";
import type { ITileable } from "./ITileable";
import { IDraggableType } from "../IDraggable";
import type { IDraggableTarget } from "../IDraggableTarget";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import { ImplementsDecorator } from "../../../../../../../shared/src/library/decorators/ImplementsDecorator";

@ImplementsDecorator(ITileType, IDraggableType)
@ComponentDecorator()
export abstract class Tile<A extends IBaseApp<A>, D extends ITileData> extends Component<A> implements ITile<A, D>
{
    protected _tileable:ITileable<A, D, ITile<A, D>>;

    protected _data?:D;

    private _x = 0;
    private _y = 0;
    protected _width = 0;
    protected _height = 0;
    private _scale = 1;

    protected _eventListenerAssistant!:EventListenerAssistant<A>;

    public readonly onClickedSignal = new Signal<[this, MouseEvent]>(this);
    public readonly onDoubleClickedSignal = new Signal<[this, MouseEvent]>(this);
    public readonly onRightClickedSignal = new Signal<[this, MouseEvent]>(this);

    private _dragging = false;
    private _dragCounter = 0; //why dragCounter? https://stackoverflow.com/questions/7110353/html5-dragleave-fired-when-hovering-a-child-element

    public readonly onDragStartSignal = new Signal<[this, dragEvent:DragEvent]>(this);
    public readonly onDragSignal = new Signal<[this, dragEvent:DragEvent]>(this);
    public readonly onDragEndSignal = new Signal<[this, dragEvent:DragEvent]>(this);

    public readonly onDragEnterSignal = new Signal<[this, dragEvent:DragEvent]>(this);
    public readonly onDragOverSignal = new Signal<[this, dragEvent:DragEvent]>(this);
    public readonly onDragLeaveSignal = new Signal<[this, dragEvent:DragEvent]>(this);
    public readonly onDropSignal = new Signal<[this, dragEvent:DragEvent]>(this);
    
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, any>, html?:string)
    {
        super(app, destructor, element, html);

        this._tileable = tileable;
    }

    public override async init(...args:any):Promise<void>
    {
        this._eventListenerAssistant = new EventListenerAssistant(this._app, this, this);

        this._eventListenerAssistant.subscribe(this._element, 'click', this.onClicked);
        this._eventListenerAssistant.subscribe(this._element, 'dblclick', this.onDoubleClicked);
        this._eventListenerAssistant.subscribe(this._element, 'contextmenu', this.onRightClicked);

        this._eventListenerAssistant.subscribe(this._element, 'dragstart', this.onDragStart);
        this._eventListenerAssistant.subscribe(this._element, 'drag', this.onDrag);
        this._eventListenerAssistant.subscribe(this._element, 'dragend', this.onDragEnd);

        this._eventListenerAssistant.subscribe(this._element, 'dragenter', this.onDragEnter);
        this._eventListenerAssistant.subscribe(this._element, 'dragover', this.onDragOver);
        this._eventListenerAssistant.subscribe(this._element, 'dragleave', this.onDragLeave);
        this._eventListenerAssistant.subscribe(this._element, 'drop', this.onDrop);
    
        return super.init();
    }

    public async renew(data:D | undefined):Promise<any>
    {   
        //if (data !== undefined && data === this._data) 
        //{
        //data.invalidated = false;
        //return;
        //}

        this.onClickedSignal.clear();
        this.onDoubleClickedSignal.clear();
        this.onRightClickedSignal.clear();
        
        this.onDragStartSignal.clear();
        this.onDragSignal.clear();
        this.onDragEndSignal.clear();
        
        this.onDragEnterSignal.clear();
        this.onDragOverSignal.clear();
        this.onDragLeaveSignal.clear();
        this.onDropSignal.clear();

        this._data = data;

        if (data === undefined) 
        {
            this.name = '';
            return;
        }

        this.name = data.id;
        data.invalidated = false;

        this.tileable.onTileRenewed(this);
    }

    protected onClicked(event:MouseEvent):boolean
    {
        this.onClickedSignal.dispatch(this, event);

        return true;
    }

    protected onDoubleClicked(event:MouseEvent):boolean
    {
        this.onDoubleClickedSignal.dispatch(this, event);

        return true;
    }

    protected onRightClicked(event:MouseEvent):boolean
    {
        this.onRightClickedSignal.dispatch(this, event);

        return true;
    }

    protected onDragStart(event:DragEvent):boolean
    {
        this._dragCounter = 0;
        this._dragging = true;
        
        this.selected = true; //select if not already selected

        this._element.classList.add('dragging');

        this.onDragStartSignal.dispatch(this, event);

        this._app.dragAndDropManager.onDragStart(this, event);

        return true;
    }

    protected onDrag(event:DragEvent):boolean
    {
        this._element.classList.remove('dragging');

        this.onDragSignal.dispatch(this, event);

        return true;
    }

    protected onDragEnd(event:DragEvent):boolean
    {
        this._dragging = false;

        this.onDragEndSignal.dispatch(this, event);

        this._app.dragAndDropManager.onDragEnd(this, event);

        return true;
    }

    protected onDragEnter(event:DragEvent):boolean
    {
        this._dragCounter++;
        if (this._dragCounter !== 1) return false;

        this.onDragEnterSignal.dispatch(this, event);

        return true;
    }

    protected onDragOver(event:DragEvent):boolean
    {
        this.onDragOverSignal.dispatch(this, event);

        return true;
    }

    protected onDragLeave(event:DragEvent):boolean
    {
        this._dragCounter--;
        if (this._dragCounter !== 0) return false;

        this.onDragLeaveSignal.dispatch(this, event);

        return true;
    }

    protected onDrop(event:DragEvent):boolean
    {
        event.stopImmediatePropagation();

        this._dragCounter = 0;
        this.onDropSignal.dispatch(this, event);

        this._app.dragAndDropManager.onDraggableDropped(this, event);

        return true;
    }

    public setPosition(x:number, y:number):void
    {
        if (x !== this._x) this._element.style.left = x + 'px';
        if (y !== this._y) this._element.style.top = y + 'px';

        this._x = x;
        this._y = y;
    }

    public setSize(width:number, height:number):void 
    {
        if (width !== this._width) this._element.style.width = width + 'px';
        if (height !== this._height) this._element.style.height = height + 'px';

        this._width = width;
        this._height = height;
    }

    public setScale(scale:number):void
    {
        if (scale !== this._scale) this._element.style.transform = `scale(${scale})`;

        this._scale = scale;
    }

    public get scale():number
    {
        return this._scale;
    }

    public get scaledWidth():number
    {
        return this.width * this._scale;
    }

    public get scaledHeight():number
    {
        return this.height * this._scale;
    }

    public get selected():boolean
    {
        if (this._data === undefined) return false;

        return this._data.selected;
    }

    public set selected(val:boolean) 
    {
        if (this._data === undefined) throw new Error('Tile data is undefined');

        this._data.selected = val;
    }

    public get data():D
    {
        if (this._data === undefined) throw new Error('Tile data is undefined');

        return this._data;
    }

    public get width():number
    {
        return this._width;
    }

    public get height():number
    {
        return this._height;
    }

    public get x():number
    {
        return this._x;
    }

    public get y():number
    {
        return this._y;
    }

    public get tileable():ITileable<A, D, ITile<A, D>>
    {
        return this._tileable;
    }

    public get dragTarget():IDraggableTarget
    {
        return this._tileable;
    }

    public get dragging():boolean
    {
        return this._dragging;
    }

    public get id():string
    {
        return this.name;
    }
    
    public set id(id:string)
    {
        this.name = id;
    }

    public async dnit():Promise<boolean>
    {
        if (await super.dnit(false) !== true) return false;

        await this.renew(undefined);

        return true;
    }
}

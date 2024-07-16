/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { FitBoard, FitboardElements } from "../../../../../library/components/board/fit/FitBoard";
import type { IStorageTileData } from "../../../../../library/components/board/IStorageTileData";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IDraggable } from "../../../../../library/components/IDraggable";
import type { IApp } from "../../../../IApp";
import { GridTile } from "./GridTile";
import html from './GridBoard.html';
import { Signal } from "../../../../../../../../../shared/src/library/signal/Signal";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";

class Elements extends FitboardElements
{
    tileTemplate!:HTMLTemplateElement;
}

@ComponentDecorator()
export class GridBoard<A extends IApp<A>, D extends IStorageTileData> extends FitBoard<A, D, GridTile<A, D>>
{
    private _tileTemplateHTML?:string;

    public readonly onTileClickedSignal = new Signal<[GridBoard<A, D>, D]>(this);
    public readonly onTileDoubleClickedSignal = new Signal<[GridBoard<A, D>, D]>(this);

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element);
    }

    protected override preprocessHTML(element:HTMLElement):HTMLElement
	{ 
        const fragment = this._app.domUtil.createDocumentFragment(html);
        element.appendChild(fragment);

        return super.preprocessHTML(element);
	}

    public override async init():Promise<void>     
    {
        type TileConstructor = typeof GridTile<A, D>;

        return super.init(100, 100, .90, 1.10, (data:D, getFromPool:(tileConstructor:TileConstructor) => InstanceType<TileConstructor> | undefined):[InstanceType<TileConstructor>, Promise<void>] =>
        {
            const Class = GridTile<A, D>;

            let tile = getFromPool(Class);
            let promise:Promise<any>;
            if (tile) 
            {
                promise = tile.renew(data);
            }
            else
            {
                [tile, promise] = this._app.componentFactory.createComponent<TileConstructor>(this, Class, [this, this._app.userManager.systemDrive], [], [], {name:data.id, log:false});
                promise = promise.then(() => tile!.renew(data));
            }

            return [tile, promise];
        }, 
        (tile:InstanceType<TileConstructor>) =>
        {
            tile.onClickedSignal.subscribe(this, (tile:InstanceType<TileConstructor>, event:Event) => this.onTileClickedSignal.dispatch(this, tile.data));
            tile.onDoubleClickedSignal.subscribe(this, (tile:InstanceType<TileConstructor>, event:Event) => this.onTileDoubleClickedSignal.dispatch(this, tile.data));
        }, 
        (tile:InstanceType<TileConstructor>) =>
        {
        });          
    }

    public get tileTemplateHTML():string { return this._tileTemplateHTML ?? (this._tileTemplateHTML = this._elements.tileTemplate.innerHTML); }

    public override setDragData(draggable:IDraggable, event:DragEvent):void
    {
    }

    public override clearDragData():void
    {
    }

    public override get requiresManualInitialization():boolean { return false; }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { FitBoard, FitboardElements } from "../../../../../library/components/board/fit/FitBoard";
import type { IStorageTileData } from "../../../../../library/components/board/IStorageTileData";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IDraggable } from "../../../../../library/components/IDraggable";
import type { IApp } from "../../../../IApp";
import { PDFTile } from "./PDFTile";
import html from './PDFBoard.html';
import { Signal } from "../../../../../../../../../shared/src/library/signal/Signal";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { ICollection } from "../../../../../../../../../shared/src/library/collection/ICollection";
import { type PDF } from "../../../../utils/PDFUtil";

class Elements extends FitboardElements
{
    tileTemplate!:HTMLTemplateElement;
}

@ComponentDecorator()
export class PDFBoard<A extends IApp<A>, D extends IStorageTileData> extends FitBoard<A, D, PDFTile<A, D>>
{
    private _tileTemplateHTML?:string;

    public readonly onTileClickedSignal = new Signal<[PDFBoard<A, D>, D]>(this);
    public readonly onTileDoubleClickedSignal = new Signal<[PDFBoard<A, D>, D]>(this);

    public readonly onPageChangedSignal = new Signal<[PDFBoard<A, D>, number, number]>(this);

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
        type TileConstructor = typeof PDFTile<A, D>;

        return super.init(true, 700, 100, undefined, (data:D, getFromPool:(tileConstructor:TileConstructor) => InstanceType<TileConstructor> | undefined):[InstanceType<TileConstructor>, Promise<void>] =>
        {
            const Class = PDFTile<A, D>;

            let tile = getFromPool(Class);
            let promise:Promise<any>;
            if (tile) 
            {
                promise = tile.renew(data);
            }
            else
            {
                [tile, promise] = this._app.componentFactory.createComponent<TileConstructor>(this, Class, [this], [], [], {name:data.id, log:false});
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

    public pdf:PDF | undefined;
    public pageDimensions:{width:number, height:number} | undefined;
    public override async setDataProvider(dataProvider:ICollection<A, D> | undefined, pdf:PDF):Promise<void>
    {
        this.pdf = pdf;

        await super.setDataProvider(undefined);

        const pageDimensions = this.pageDimensions = await this._app.pdfUtil.getPageDimensions(pdf, 1);

        this.tileHeight = Math.ceil(pageDimensions.height);

        return super.setDataProvider(dataProvider);
    }

    #_lastPage = -1;
    protected onRedraw():void 
    {
        let page;
        if (Math.abs(this._tileYOffset - this._padding[0]) < (this.tileHeight / 5)) page = this._visibleTileStartIndex + 1;
        else page = this._visibleTileStartIndex + 2;

        if (this.#_lastPage === page) return;
        this.#_lastPage = page;

        this.onPageChangedSignal.dispatch(this, page, this.pdf!.numPages);
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
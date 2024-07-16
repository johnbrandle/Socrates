/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../../IApp";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IPDFTileData } from "./IPDFTileData";
import type { ITileable } from "../../../../../library/components/board/ITileable";
import { IPDFTileType, type IPDFTile } from "./IPDFTile";
import type { PDFBoard } from "./PDFBoard";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import { Tile } from "../../../../../library/components/board/Tile";

export class PDFTileElements 
{
    content!:HTMLElement;
    canvas!:HTMLCanvasElement;
}

@ImplementsDecorator(IPDFTileType)
@ComponentDecorator()
export class PDFTile<A extends IApp<A>, D extends IPDFTileData> extends Tile<A, D> implements IPDFTile<A, D>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, any>)
    {
        super(app, destructor, element, tileable);

        this.cnit();
    }

    protected cnit()
    {
        this._element.style.position = 'absolute';
        this._element.style.left = '0px';
        this._element.style.top = '0px';
        this._element.style.overflow = 'hidden';
        this._element.style.transformOrigin = '0 0';
        this._element.style.willChange = 'top, left, transform';
    }

    public override async init():Promise<void>
    {
        const html = (this._tileable as unknown as PDFBoard<A, D>).tileTemplateHTML;
        
        this.element.innerHTML = html;

        const elements = this._elements;
         
        this.set(elements);

        return super.init();
    }

    public override async renew(data:D):Promise<void>
    {
        await super.renew(data);

        if (data !== undefined)
        {
            const pdfBoard = this._tileable as unknown as PDFBoard<A, D>;
            
            const pdf = pdfBoard.pdf!;
            const pageDimensions = pdfBoard.pageDimensions!;

            const canvas = this._elements.canvas;
            
            await this._app.pdfUtil.drawPageToCanvas(pdf, parseInt(data.id), {canvas});

            const pdfWidth = parseInt(canvas.style.width);
            const pdfHeight = parseInt(canvas.style.height);
            if (pageDimensions.width !== pdfWidth || pageDimensions.height !== pdfHeight)
            {
                canvas.style.width = pageDimensions.width + 'px';
                canvas.style.height = pageDimensions.height + 'px';
            }

            canvas.style.width = 'unset'; //we could make this a display option 
        }
    }

    protected override get _elements():PDFTileElements { return this.__elements ?? (this.__elements = new PDFTileElements()); }
}

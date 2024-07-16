/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../../IApp";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import { StorageTile } from "../../../../../library/components/board/StorageTile";
import type { IGridTile } from "./IGridTile";
import type { IGridTileData } from "./IGridTileData";
import type { ITileable } from "../../../../../library/components/board/ITileable";
import { IGridTileType } from "./IGridTile";
import type { GridBoard } from "./GridBoard";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IDrive } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";

@ImplementsDecorator(IGridTileType)
@ComponentDecorator()
export class GridTile<A extends IApp<A>, D extends IGridTileData> extends StorageTile<A, D> implements IGridTile<A, D>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, any>, drive:IDrive<A>)
    {
        super(app, destructor, element, tileable, drive);
    }

    public override async init():Promise<void>
    {
        const html = (this._tileable as unknown as GridBoard<A, D>).tileTemplateHTML;

        return super.init(html);
    }
}

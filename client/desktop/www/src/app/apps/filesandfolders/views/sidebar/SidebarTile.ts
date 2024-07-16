/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { ISidebarTile } from "./ISidebarTile";
import { ISidebarTileType } from "./ISidebarTile";
import type { IApp } from "../../../../IApp";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { ITileable } from "../../../../../library/components/board/ITileable";
import { StorageTile } from "../../../../../library/components/board/StorageTile";
import type { ISidebarTileData } from "./ISidebarTileData";
import type { SidebarBoard } from "./SidebarBoard";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IDrive } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";

@ImplementsDecorator(ISidebarTileType)
@ComponentDecorator()
export class SidebarTile<A extends IApp<A>, D extends ISidebarTileData> extends StorageTile<A, D> implements ISidebarTile<A, D>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, any>, drive:IDrive<A>)
    {
        super(app, destructor, element, tileable, drive);
    }

    public override async init(...args:any):Promise<void>
    {
        const html = (this._tileable as unknown as SidebarBoard<A, D>).tileTemplateHTML;

        return super.init(html);
    }

    protected override sizeElements(height:number):void
    {
        if (height === 0) return;

        const elements = this._elements;
        const thumbElement = elements.thumb;
        
        const maxHeight = this.height;

        thumbElement.style.width = maxHeight + 'px';
        thumbElement.style.height = maxHeight + 'px';
        thumbElement.style.fontSize = (maxHeight / 2) + 'px';
 
        elements.name.style.visibility = 'visible';
    }
}

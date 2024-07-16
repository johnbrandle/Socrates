/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { ITileable } from "../../../../library/components/board/ITileable";
import { ComponentDecorator } from "../../../../library/decorators/ComponentDecorator";
import type { IApp } from "../../../IApp";
import { StorageTile } from "../../../../library/components/board/StorageTile";
import type { IDesktopTileData } from "./IDesktopTileData";
import type { DesktopTileable } from "./DesktopTileable";
import type { IDestructor } from "../../../../../../../../shared/src/library/IDestructor";
import type { IDrive } from "../../../../../../../../shared/src/library/file/drive/IDrive";

@ComponentDecorator() 
export class DesktopTile<A extends IApp<A>, D extends IDesktopTileData> extends StorageTile<A, D>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, any>, drive:IDrive<A>) 
    {
        super(app, destructor, element, tileable, drive);
    }

    protected override cnit()
    {
    }

    public override async init():Promise<void>
    {
        const html = (this._tileable as unknown as DesktopTileable<A, D, DesktopTile<A, D>>).tileTemplateHTML;

        return super.init(html);
    }

    public async renew(data:D | undefined):Promise<any>
    {
        return await super.renew(data);
    }

    protected override onDragEnter(event:DragEvent):boolean
    {
        if (!this._data?.info) return false;

        return super.onDragEnter(event);
    }

    protected override onDragLeave(event:DragEvent):boolean
    {
        if (!this._data?.info) return false;
        
       return super.onDragLeave(event);
    }
}

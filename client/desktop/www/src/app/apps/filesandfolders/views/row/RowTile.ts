/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IRowTile } from "./IRowTile";
import { IRowTileType } from "./IRowTile";
import type { IApp } from "../../../../IApp";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import { StorageTile, StorageTileElements } from "../../../../../library/components/board/StorageTile";
import type { IRowTileData } from "./IRowTileData";
import type { RowBoard } from "./RowBoard";
import type { ITileable } from "../../../../../library/components/board/ITileable";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IDrive } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";

class Elements extends StorageTileElements
{
    modified!:HTMLElement;
    size!:HTMLElement;
    kind!:HTMLElement;
}

const formatDate = (timestamp:number):string =>
{
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });
}

@ImplementsDecorator(IRowTileType)
@ComponentDecorator()
export class RowTile<A extends IApp<A>, D extends IRowTileData> extends StorageTile<A, D> implements IRowTile<A, D>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, RowTile<A, D>>, drive:IDrive<A>)
    {
        super(app, destructor, element, tileable, drive);
    }

    public override async init(...args:any):Promise<void>
    {
        const html = (this._tileable as unknown as RowBoard<A, D>).tileTemplateHTML;

        return super.init(html);
    }

    public override async renew(data:D | undefined):Promise<any>
    {
        super.renew(data);

        const elements = this._elements;

        if (data === undefined || data.info === undefined) return;

        const storageData = data.info;

        if (storageData.type === 'folder')
        {
            const storageFolderData = storageData;

            elements.modified.innerText = '-';
            elements.size.innerText = '-';
            elements.kind.innerText = storageFolderData.compressed ? 'Archive' : 'Folder';
            return;
        }

        const storageFileData = storageData;

        elements.modified.innerText = formatDate(storageFileData.modified);
        elements.size.innerText = this._app.textUtil.formatBytes(storageFileData.data.bytes.decrypted);
        elements.kind.innerText = storageFileData.type;
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

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}

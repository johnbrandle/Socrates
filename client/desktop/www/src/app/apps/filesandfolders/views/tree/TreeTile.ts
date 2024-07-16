/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../../IApp";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import { StorageTile, StorageTileElements } from "../../../../../library/components/board/StorageTile";
import type { ITreeTile } from "./ITreeTile";
import type { ITreeTileData } from "./ITreeTileData";
import type { ITileable } from "../../../../../library/components/board/ITileable";
import { ITreeTileType } from "./ITreeTile";
import type { TreeBoard } from "./TreeBoard";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IDrive } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";

class Elements extends StorageTileElements 
{
    caret!:HTMLElement;
}

@ImplementsDecorator(ITreeTileType)
@ComponentDecorator()
export class TreeTile<A extends IApp<A>, D extends ITreeTileData> extends StorageTile<A, D> implements ITreeTile<A, D>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, TreeTile<A, D>>, storageFileSystem:IDrive<A>)
    {
        super(app, destructor, element, tileable, storageFileSystem);
    }

    public override async init(...args:any):Promise<void>
    {
        const html = (this._tileable as unknown as TreeBoard<A, D>).tileTemplateHTML;

        return super.init(html);
    }

    public async renew(data:D | undefined):Promise<any>
    {
        super.renew(data);

        if (data === undefined || data.info === undefined) return;

        const storageData = data.info;

        if (storageData.type !== 'folder') this._elements.caret.style.visibility = 'hidden';
        else 
        {
            const caret = this._elements.caret;
            if (data.isExpanded === true) caret.firstElementChild?.classList.replace('bi-caret-right', 'bi-caret-down');
            else caret.firstElementChild?.classList.replace('bi-caret-down', 'bi-caret-right');

            caret.style.visibility = 'visible';
        }
    
        this._element.style.paddingLeft = (data.indent * 25) + 'px';
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

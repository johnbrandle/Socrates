/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../../IApp";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import { StorageTile } from "../../../../../library/components/board/StorageTile";
import type { ITabTile } from "./ITabTile";
import type { ITabTileData } from "./ITabTileData";
import type { ITileable } from "../../../../../library/components/board/ITileable";
import { ITabTileType } from "./ITabTile";
import type { TabBoard } from "./TabBoard";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IDrive } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import { ImplementsDecorator } from "../../../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { IAborted } from "../../../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../../../shared/src/library/error/IError";

@ImplementsDecorator(ITabTileType)
@ComponentDecorator()
export class TabTile<A extends IApp<A>, D extends ITabTileData> extends StorageTile<A, D> implements ITabTile<A, D>
{
    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, tileable:ITileable<A, D, any>, drive:IDrive<A>)
    {
        super(app, destructor, element, tileable, drive);
    }

    public override async init():Promise<void>
    {
        const html = (this._tileable as unknown as TabBoard<A, D>).tileTemplateHTML;

        return super.init(html);
    }

    public override async renew(data:D | undefined):Promise<void | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            _.check(await super.renew(data));

            const elements = this._elements;

            if (data === undefined || data.info === undefined) return;

            const storageData = data.info;

            this.id = storageData.path;
            elements.name.innerText = storageData.metadata.title as string;
            elements.name.title = storageData.metadata.title as string;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to renew storage tile', arguments, {names:[this.constructor, this.renew]});
        }
    }
}

/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { View } from "../../../../../library/components/view/View";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IApp } from "../../../../IApp";
import type { IPDFTileData } from "./IPDFTileData";
import html from './PDFView.html';
import type { PDFBoard } from "./PDFBoard";
import { DebounceAssistant } from "../../../../../library/assistants/DebounceAssistant";
import { SignalAssistant } from "../../../../../library/assistants/SignalAssistant";
import { Signal } from "../../../../../../../../../shared/src/library/signal/Signal";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { filepath, folderpath } from "../../../../../../../../../shared/src/library/file/Path";
import type { IAbortable } from "../../../../../../../../../shared/src/library/abort/IAbortable";
import type { IAborted } from "../../../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../../../shared/src/library/error/IError";
import { AbortController } from "../../../../../../../../../shared/src/library/abort/AbortController";
import { Collection } from "../../../../../../../../../shared/src/library/collection/Collection";
import type { IDriveFile } from "../../../../../../../../../shared/src/library/file/drive/IDriveFile";
import { DataFormat } from "../../../../../../../../../shared/src/library/file/drive/IDrive";

class Elements
{   
    board!:HTMLElement;
}

@ComponentDecorator()
export class PDFView<A extends IApp<A>> extends View<A>
{
    private _board!:PDFBoard<A, IPDFTileData>;

    private _signalAssistant!:SignalAssistant<A>;

    public readonly onTileClickedSignal = new Signal<[PDFView<A>, folderpath | filepath]>(this);
    public readonly onTilePageChangedSignal = new Signal<[PDFView<A>, number, number]>(this);

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init():Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._signalAssistant = new SignalAssistant(this._app, this);

        this._board = elements.board.component as PDFBoard<A, IPDFTileData>;

        this._signalAssistant.subscribe(this._board.onPageChangedSignal, (_board, pageNum, totalPages) =>
        {
            this.onTilePageChangedSignal.dispatch(this, pageNum, totalPages);
        });

        return super.init();
    }

    public preview = new DebounceAssistant(this, async (abortable:IAbortable, driveFile:IDriveFile<A>):Promise<void | IAborted | IError> =>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = abortController.abortableHelper.throwIfAborted();
            
            const uint8Array = _.value(await driveFile.drive.getFileData(driveFile.path, abortController, DataFormat.Uint8Array));
           
            const pdf = _.value(await this._app.pdfUtil.load(uint8Array));

            const tileData = [];
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) tileData.push({id:pageNum.toString(), invalidated:true, selected:false});
            
            const collection = new Collection(this._app, tileData);
            this._board.setDataProvider(collection, pdf);    
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to set current folder', [], {names:[this.constructor, 'preview']});
        }
    }, {throttle:true, delay:true, id:'setCurrentFolder'});

    public override get transparent():boolean { return false; } //need to override this again, since view sets this to true

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}
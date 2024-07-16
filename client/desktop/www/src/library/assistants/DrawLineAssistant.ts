/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import type { IBaseApp } from "../IBaseApp";
import { DebounceAssistant } from "./DebounceAssistant";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import type { IAbortable } from "../../../../../../shared/src/library/abort/IAbortable";
import type { IAborted } from "../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../shared/src/library/error/IError";

/**
 * An assistant for rendering lines of text to a canvas.
 */
export class DrawLineAssistant<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private _canvas:HTMLCanvasElement;
    private _context?:CanvasRenderingContext2D;
    private _lines:{id:string, previous:string | undefined, current:string}[] = [];
    private _textHeight = 0;
    private _charWidth = 0;

    private _previousWidth = 0;
    private _previousHeight = 0;
    
    private _lineSpacing:number;
    private _monospaceFontName:string;
    private _fontSize:number;
    private _fillStyle:string;

    private _render:DebounceAssistant<A>;

    constructor(app:A, destructor:IDestructor<A>, canvas:HTMLCanvasElement, lineSpacing=5, fontSize=12, monospaceFontName='monospace', fillStyle='#fff')
    {
        super(app, destructor);

        this._canvas = canvas;
        this._lineSpacing = lineSpacing;
        this._fontSize = fontSize;
        this._monospaceFontName = monospaceFontName;
        this._fillStyle = fillStyle;

        this._render = new DebounceAssistant(this, async (abortable:IAbortable):Promise<void | IAborted | IError> =>
        {
            try
            {
                const _ = this.createAbortableHelper(abortable).throwIfAborted();

                const changed = this.#updateCanvasSize();
                if (changed !== true) return;

                this.#renderAllLines();
            }
            catch (error)
            {
                return app.warn(error, 'failed to _render', [], {names:[this.constructor, '_render']});
            }
        }, {throttle:true, delay:true, id:'_render'});
    }

    /**
     * Returns the 2D rendering context of the canvas element, or undefined if the context cannot be retrieved.
     * Also sets the font size and calculates the text height and character width for future use.
     * @returns The 2D rendering context of the canvas element, or undefined if the context cannot be retrieved.
     */
    #getContext():CanvasRenderingContext2D | undefined 
    {
        let context = this._context;

        if (context !== undefined) return context;

        context = this._context = this._canvas.getContext('2d') ?? undefined;
        
        if (context !== undefined)
        {
            context.font = `${this._fontSize}px ${this._monospaceFontName}`;
            
            let metrics = context.measureText('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890()[]');
            this._textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

            metrics = context.measureText('M');
            this._charWidth = metrics.width;
        }
    
        return context;
    }

    /**
     * Adds a line at the specified index with the given ID.
     * @param index The index at which to add the line.
     * @param lineID The ID of the line to add.
     */
    public addLineAt(index:number, lineID:string):void 
    {
        if (index < 0 || index > this._lines.length) this._app.throw('Index out of bounds: {index}', [index], {correctable:true});

        this._lines.push({id:lineID, previous:undefined, current:''});
    }

    public addLine(lineID:string):void
    {
        this.addLineAt(this._lines.length, lineID);
    }

    public removeLine(lineID:string):void
    {
        let index = -1;
        for (let i = this._lines.length; i--;)
        {
            if (this._lines[i].id !== lineID) continue;
            
            index = i;
            break;
        }

        if (index === -1) this._app.throw('No line exists with the given ID: {lineID}', [lineID], {correctable:true});

        this._lines.splice(index, 1);

        this._render.execute();
    }

    /**
     * Writes the given text to the specified line ID.
     * @param lineID - The ID of the line to write to.
     * @param text - The text to write to the line.
     */
    public write(lineID:string, text:string):void 
    {
        let line;
        for (let i = this._lines.length; i--;)
        {
            if (this._lines[i].id !== lineID) continue;
            
            line = this._lines[i];
            break;
        }

        if (line === undefined) this._app.throw('No line exists with the given ID: {lineID}', [lineID], {correctable:true});    

        line.previous = line.current;
        line.current = text;

        this._render.execute();
    }

    /**
     * Updates the size of the canvas based on the maximum text length and number of lines.
     * @returns {void}
     */
    #updateCanvasSize():boolean
    {
        const context = this.#getContext();
        if (context === undefined) return false;

        const charWidth = this._charWidth;

        let maxWidth = 0;
        let changed = false;
        for (const line of this._lines)
        {
            if (line.previous !== line.current) changed = true; 

            maxWidth = Math.max(maxWidth, line.current.length * charWidth);
        }

        if (changed !== true) return false;

        const oldWidth = this._previousWidth;
        const oldHeight = this._previousHeight;

        const newWidth = Math.round(maxWidth + 10);
        const newHeight = Math.round((this._lines.length * (this._textHeight + this._lineSpacing) + this._textHeight) + this._lineSpacing);

        if (oldWidth !== newWidth) this._canvas.width = newWidth;
        if (oldHeight !== newHeight) this._canvas.height = newHeight;
        if (oldWidth === newWidth && oldHeight === newHeight) context.clearRect(0, 0, oldWidth, oldHeight);

        this._previousWidth = newWidth;
        this._previousHeight = newHeight;

        return true;
    }

    /**
     * Renders all lines on the canvas.
     * @returns {void}
     */
    #renderAllLines():void 
    {
        const context = this.#getContext();
        if (context === undefined) return;

        context.font = `${this._fontSize}px ${this._monospaceFontName}`;
        context.fillStyle = this._fillStyle;
        context.textAlign = 'right';

        let index = 0;
        for (const line of this._lines)
        {
            const y = index * (this._textHeight + this._lineSpacing) + this._textHeight;
            context.fillText(line.current, this._canvas.width - 5, y);

            index++;
        }
    }
}

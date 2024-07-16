/**
 * @license		UNLICENSED
 * @date		04.01.2023
 * @copyright   Untitled.io
 * @author      John Brandle
 */

import path from 'path';
import { Main } from '../../../Main';
import fs from 'fs-extra';
import crypto from 'crypto-js';
import sass from 'sass';
import type { Cheerio, CheerioAPI } from 'cheerio';
import { FileUtil } from '../../../utils/FileUtil';

export class StyleProcessor 
{
    private styleCounter = 0;
    styleIntegrityHashes:Array<string> = [];
    styleStrings:Array<string> = [];
    
    htmlStyleLoader:HTMLStyleLoaderProcessor = new HTMLStyleLoaderProcessor(this);

    constructor()
    {
    }

    getStylesString(compressed:boolean = false):string
    {
        let styles = this.styleStrings.join('\n');

        let options:any = {style: compressed ? 'compressed' : 'expanded'};
        return sass.compileString(styles, options).css;
    }

    /*
    processInlineStyles($:CheerioAPI, elementsWithStyle:Cheerio<Element>)
    {
        let styleString = '';
        elementsWithStyle.each((index:number, element:any) => 
        {
            //create a new CSS class with the styles
            let className = this.generateClassName();
            styleString += `.${className} { ${$(element).attr('style')} }\n`;
    
            //update the class attribute of the element
            let existingClass = $(element).attr('class') || '';
            let classes = existingClass ? existingClass + ' ' + className : className;
            $(element).attr('class', `${classes}`);
    
            //remove the style attribute
            $(element).removeAttr('style');
        });

        let hash = crypto.SHA256(styleString).toString(crypto.enc.Base64);
    }
    
    processStyleNode(style:any, uri:string)
    {
        let css = fs.readFileSync(uri, {encoding:'utf8'}).replace(/\t|\n/g, '');
        style.text(css);
        let hash = crypto.SHA256(style.text()).toString(crypto.enc.Base64);
        this.styleIntegrityHashes.push(hash);
        style.attr('integrity', `sha256-${hash}`);
        style.attr('crossorigin', `anonymous`);
    }
    */

    generateClassName()
    {
        return 'gen-style-' + this.styleCounter++;
    }
}

class HTMLStyleLoaderProcessor
{
    _styleProcessor;

    constructor (styleProcessor:StyleProcessor)
    {
        this._styleProcessor = styleProcessor;
    }

    process = async ($:CheerioAPI, filePathPart:string) =>
    {
        if (!(await fs.exists(filePathPart + '.ts'))) throw new Error('html file must have the same name as the associated ts file');
    
        let cssClassName = FileUtil.convertBackslashesToForwardSlashes(filePathPart).split(FileUtil.convertBackslashesToForwardSlashes(Main.WWW_SOURCE_PATH)).join('').split('/').join('-'); //example: screens-gift-Gift

        let elementsWithStyle = $('[style]');
        let inlineStyleString = '';
        elementsWithStyle.each((index:number, element:any) => 
        {
            //create a new CSS class with the styles
            let className = this._styleProcessor.generateClassName();
            let process = $(element).attr('style')!.split(';').join(',').split('!important').join('');
            inlineStyleString += `.${className} 
            { 
                @include important((${process})); 
            }`;

            //update the class attribute of the element
            let existingClass = $(element).attr('class') || '';
            let classes = existingClass ? existingClass + ' ' + className : className;
            $(element).attr('class', `${classes}`);

            //remove the style attribute
            $(element).removeAttr('style');
        });

        if (inlineStyleString.trim())
        {
            inlineStyleString = `@mixin important($declarations) 
                                {
                                    @each $property, $value in $declarations 
                                    {
                                        #{$property}: $value !important;
                                    }
                                }` + inlineStyleString;
            
            try
            {
                inlineStyleString = (await sass.compileStringAsync('.' + cssClassName + '{' + inlineStyleString + '}')).css;
            }
            catch(error)
            {
                console.error('SCSS compilation error:', error);
                inlineStyleString = '';
            }               
        }

        let styles = $('style');
        for (let i = styles.length; i--;)
        {
            let element = $(styles[i]);

            let styleString = '.' + cssClassName + '{' + element.text() + '}'; //wrap in component class name, so component styles do not affect everything else
            if (element.attr('type') === 'text/scss')
            {
                try
                {
                    styleString = (await sass.compileStringAsync(styleString)).css;
                }
                catch(error)
                {
                    console.error('SCSS compilation error:', error);
                    styleString = '';
                }
            }
            
            if (element.attr('name') !== undefined) //if the style has a name attribute, we are not supposed to remove it
            {    
                element.attr('type', 'text/css');
                let hash = crypto.SHA256(element.text()).toString(crypto.enc.Base64);
                this._styleProcessor.styleIntegrityHashes.push(hash);
            }
            else
            {
                this._styleProcessor.styleStrings.push(styleString);
                element.remove();
            }
        }

        this._styleProcessor.styleStrings.push(inlineStyleString); //doing this here to override anything that came before
    }
}
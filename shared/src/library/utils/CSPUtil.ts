/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DevEnvironment } from "../IEnvironment.ts";
import { SealedDecorator } from "../decorators/SealedDecorator.ts";
import { IBaseApp } from "../IBaseApp.ts";

@SealedDecorator()
export class CSPUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    ///merges the csp found in an html file with the restrictive default server-side csp, csp settings found in the html will override settings in the default csp
    public merge(fileExtension:string, baseCSP:Record<string, string>, uint8Array:Uint8Array):[Record<string, string>, Uint8Array]
    {
        if (fileExtension !== '.html') return [baseCSP, uint8Array];

        const extractCSP = (htmlString:string):[string, string] =>
        {    
            const regex = /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"[^>]*>/; //regular expression to match the entire meta tag and the content attribute.
        
            const tagMatch = htmlString.match(regex); //extracting the tag from the HTML string
        
            if (tagMatch && tagMatch.length > 0) //check if the tag was found
            {
                const modifiedHtml = htmlString.replace(regex, ''); //remove the matched tag from the original HTML string
        
                const content = tagMatch[1]; //the content of the tag is in the first capturing group
        
                return [modifiedHtml, content];
            } 
            
            this._app.throw('Content-Security-Policy meta tag not found', [], {correctable:true});
        }
        
        const [html, cspString] = extractCSP(this._app.textUtil.fromUint8Array(uint8Array));

        const rules = cspString.split(';');
        for (let i = rules.length; i--;)
        {
            const parts = rules[i].trim().split(' ');
            baseCSP[parts[0]] = parts.splice(1).join(' ') || '';
        }

        return [baseCSP, this._app.textUtil.toUint8Array(html)];
    }

    public toString(csp:Record<string, string>, environment:DevEnvironment):string
    {     
        if (environment === DevEnvironment.Dev) csp['connect-src'] = `'self' *`; //TODO
        else csp['connect-src'] = `'self' http://localhost/`; //TODO
        
        const cspProperties:Array<string> = [];
        for (const prop in csp)
        {
            if (csp[prop] === '') cspProperties.push(`${prop};`);
            else cspProperties.push(`${prop} ${csp[prop]};`);
        }

        return cspProperties.join(' ');
    }

    public get base():Record<string, string>
    {
        return {
            'default-src':`'none'`,
            'style-src':`'none'`,
            'style-src-attr':`'none'`,
            'style-src-elem':`'none'`,
            'script-src':`'none'`,
            'script-src-attr':`'none'`,
            'script-src-elem':`'none'`,
            'font-src':`'none'`,
            'img-src':`'none'`,
            'object-src':`'none'`,
            'child-src':`'none'`,
            'frame-src':`'none'`,
            'worker-src':`'none'`,
            'manifest-src':`'none'`,
            'media-src':`'none'`,
            'connect-src':`'none'`,
            'base-uri':`'none'`,
            'upgrade-insecure-requests':'',
            'block-all-mixed-content':'',
            'navigate-to':`'none'`,
            'form-action':`'none'`,
            'frame-ancestors':`'none'`,
        };
    }
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ConsoleUtil as Shared } from '../../../../../../shared/src/library/utils/ConsoleUtil.ts';
import { ErrorJSONObject } from "../../../../../../shared/src/app/json/ErrorJSONObject.ts";
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

/* 
so we can capture logs before the framework is ready, and so we can dispatch events (see index.html and Console.ts) 
TODO, revisit this 
*/
const log = self.environment.frozen.log_original;
let logs:Array<Array<any>> | undefined = self.environment.logs;

window.console.log = (...args) => 
{
    const event = new CustomEvent('consoleLog', {detail:args});
    window.dispatchEvent(event);

    if (logs !== undefined) logs.push(args);

    log.apply(window.console, args);
}

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
@SealedDecorator()
export class ConsoleUtil<A extends IBaseApp<A>> extends Shared<A>
{
    /**
     * Logs messages to the console with a specified color and prefix.
     * @param color The color to use for the log message.
     * @param func The console function to use for logging (e.g. console.log, console.warn, etc.).
     * @param datas The data to log to the console.
     * @returns Always returns false.
     */
    public override __log(prefix:string, color:string, func:Function, Class:{name:string} | {name:string}[], ...datas:any):false
    {
        if (environment.frozen.isDebug === false) return false;

        const args = ['%c' + prefix, 'color: ' + color];
        if (Array.isArray(Class)) Class = {name:Class.map((c) => c.name).join(', ')};
        args.push(Class.name, '—');

        for (let i = 0; i < datas.length; i++) 
        {
            let data = datas[i];
            if (data instanceof ErrorJSONObject) data = data.toString(); 
            
            args.push(data);
        }
        
        func.bind(console).apply(this, args);

        return false;
    }

    public error(Class:{name:string} | {name:string}[], error:Error):false; 
    public error(Class:{name:string} | {name:string}[], ...data:any[]):false;
    public error(Class:{name:string} | {name:string}[], ...data:any[]):false 
    {
        return this.__log(this._prefix, '#e5341a', console.error, Class, ...data); //always log errors
    }

    public debug = (Class:{name:string} | {name:string}[], ...data:any[]):void => environment.frozen.isDebug === true ? void this.__log(this._prefix, '#45ba5a', console.debug, Class, ...data) : undefined;
    
    /**
     * Returns an HTML element containing the formatted log arguments.
     * @param args - The arguments to format and display.
     * @returns An HTML element containing the formatted log arguments.
     */
    public logArgsToHTML = (args:any[]):HTMLElement =>
    {
        const container = document.createElement('div');
        let argIndex = 0;
      
        if (args.length === 0) return container;
      
        const formatString = args[argIndex++];
      
        if (typeof formatString !== 'string') container.innerHTML = this.formatArg(formatString);
        else 
        {
            const regex = /%[sdifoOc%]/g;
            let startIndex = 0;
            let match;
            let span;
      
            while ((match = regex.exec(formatString) ?? undefined) !== undefined) 
            {
                const specifier = match[0];
                container.append(document.createTextNode(formatString.slice(startIndex, match.index)));
                startIndex = match.index + specifier.length;
      
                if (specifier === '%%') container.append(document.createTextNode('%'));
                if (argIndex >= args.length) break;
      
                const arg = args[argIndex++];
                span = document.createElement('span');
      
                if (specifier === '%c') 
                {
                    if (typeof arg === 'string') span.style.cssText = arg;
                } 
                else span.innerHTML = this.formatArg(arg);
            }
        
            const node = document.createTextNode(formatString.slice(startIndex) + ' ');

            if (span) 
            {
                span.append(node);
                container.append(span);
            }
            else container.append(node);

            if (argIndex < args.length && formatString.includes('%c')) 
            {
                const span = document.createElement('span');
                span.innerHTML = this.formatArg(args[argIndex++]);
                container.append(span);
            }
        }
      
        while (argIndex < args.length) 
        {
            const span = document.createElement('span');
            span.innerHTML = this.formatArg(args[argIndex++]);
            container.append(span);
        }
      
        return container;
    }

    /**
     * Escapes special characters in a string to their corresponding HTML entities.
     * 
     * @param text - The string to escape.
     * @returns The escaped string.
     */
    private escapeHtml(text:string):string { return text ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : '' };
    
    /**
     * Formats the given argument as a string for console output.
     * If the argument is a string, it escapes HTML characters.
     * If the argument is an array, it formats each element recursively and joins them with commas.
     * If the argument is an object, it tries to stringify it as JSON and escapes HTML characters.
     * If the argument is anything else, it converts it to a string and escapes HTML characters.
     * @param arg - The argument to format.
     * @returns The formatted string.
     */
    private formatArg = (arg:any):string =>
    {
        if (typeof arg === 'string') return this.escapeHtml(arg);
        else if (Array.isArray(arg)) return '[' + arg.map(this.formatArg.bind(this)).join(', ') + ']';
        else if (typeof arg === 'object' && arg !== null) 
        {
            try
            {
                return this.escapeHtml(JSON.stringify(arg));
            }
            catch(e) {};
        }
        return this.escapeHtml(String(arg));
    }
      
    /**
     * Gets an array of early logs that were captured before the console was initialized.
     * @returns An array of early logs, or undefined if there were no early logs.
     */
    public get earlyLogs():Array<Array<any>> | undefined
    {
        logs = undefined;

        return self.environment.logs;
    }
}
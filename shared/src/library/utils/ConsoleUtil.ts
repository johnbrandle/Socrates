/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";
import { IBaseApp } from "../IBaseApp";

type NestedKeyDefinition = Record<string, string[]>;
type KeyDefinition = Record<string, (string | NestedKeyDefinition)[]>;

@SealedDecorator()
export class ConsoleUtil<A extends IBaseApp<A>> 
{
    protected _app:IBaseApp<any>;

    protected _prefix:string;

    public constructor(app:IBaseApp<any>, prefix:string)
    {
        this._app = app;

        this._prefix = prefix;
    }

    /**
     * Logs messages to the console with a specified color and prefix.
     * @param color The color to use for the log message.
     * @param func The console function to use for logging (e.g. console.log, console.warn, etc.).
     * @param datas The data to log to the console.
     * @returns Always returns false.
     */
    public __log(prefix:string, color:string, func:Function, Class:{name:string} | {name:string}[], ...datas:any[]):false
    {
        if (environment.frozen.isDebug === false) return false;

        if (prefix === undefined) debugger;
        const args = prefix.length > 0 ? ['%c' + prefix, 'color: ' + color] : [];

        if (Array.isArray(Class)) Class = {name:Class.map((c) => c.name).join(', ')};
        args.push(Class.name, '—');

        for (const data of datas) args.push(data);

        func.bind(console).apply(this, args);

        return false;
    }

    public log = (Class:{name:string} | {name:string}[], ...data:any[]):void => environment.frozen.isDebug === true ? void this.__log(this._prefix, '#388cc7', console.log, Class, ...data) : undefined;
    public info = (Class:{name:string} | {name:string}[], ...data:any[]):void => environment.frozen.isDebug === true ? void this.__log(this._prefix, '#148cc7', console.info, Class, ...data) : undefined;
    public warn = (Class:{name:string} | {name:string}[], ...data:any[]):false => this.__log(this._prefix, '#e4d21b', console.warn, Class, ...data); //always log warnings

    public error(Class:{name:string} | {name:string}[], error:Error):false; 
    public error(Class:{name:string} | {name:string}[], ...data:any[]):false;
    public error(Class:{name:string} | {name:string}[], ...data:any[]):false 
    {
        this.__log(this._prefix, '#e5341a', console.error, Class, ...data);

        if (environment.frozen.isDebug === true) debugger; //halt on errors in debug mode

        return false;
    }

    public debug = (Class:{name:string}, ...data:any[]):void => environment.frozen.isDebug === true ? void this.__log(this._prefix, '#45ba5a', console.debug, Class, ...data) : undefined;

    /**
     * Logs a table in the console based on the given data array and keys.
     * The keys parameter specifies the properties to include in the table.
     * If the value for a key in the keys parameter is an array, it indicates that
     * the property is an object and the array lists the keys to include from that object.
     * 
     * @param {Array<Record<string, any>>} data - The array of objects to be logged as a table.
     * @param {ColumnKeys} keys - An object or an array specifying which keys to include in the table.
     * 
     * @example
     * ```typescript
     * const data = [
     *   { component: { className: 'class1', name: 'name1' }, other: 'other1' },
     *   { component: { className: 'class2', name: 'name2' }, other: 'other2' },
     * ];
     * ConsoleUtil.table(data, { component: ['className', 'name'] });
     * ```
     * 
     * @example
     * ```typescript
     * const data = [
     *   { component: 'component1', other: 'other1' },
     *   { component: 'component2', other: 'other2' },
     * ];
     * ConsoleUtil.table(data, ['component', 'other']);
     * ```
     */
    public table(_Class:{name:string}, data:Array<Record<string, any>>, keys:KeyDefinition | string[]):void
    {
        if (environment.frozen.isDebug !== true || console.table === undefined) return;
    
        const isNestedKeyDefinition = (val: string | NestedKeyDefinition): val is NestedKeyDefinition => typeof val === 'object';
        
        const transformObject = (obj:Record<string, any>, keyMap:KeyDefinition | string[]):Record<string, any> => 
        {
            const transformed:Record<string, any> = {};
    
            if (Array.isArray(keyMap)) 
            {
                keyMap.forEach((key) => transformed[key] = obj[key]);
                return transformed;
            } 

            for (const [key, value] of Object.entries(keyMap)) 
            {
                value.forEach((subKeyOrObj) => 
                {
                    if (isNestedKeyDefinition(subKeyOrObj)) 
                    {
                        for (const [nestedKey, nestedValue] of Object.entries(subKeyOrObj)) 
                        {
                            nestedValue.forEach((nestedSubKey) => transformed[`${key}.${nestedKey}.${nestedSubKey}`] = obj[key]?.[nestedKey]?.[nestedSubKey]);
                        }
                    } 
                    else transformed[`${key}.${subKeyOrObj}`] = obj[key]?.[subKeyOrObj];
                });
            }
            
            return transformed;
        }
    
        const transformedData = data.map((item) => transformObject(item, keys));
        console.table(transformedData);
    }
}
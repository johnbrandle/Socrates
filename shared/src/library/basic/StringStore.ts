/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../decorators/SealedDecorator";

type ValueType = boolean | string | number | null | ValueType[];

@SealedDecorator()
export class StringStore 
{
    #lookupTable:{ [key: string]: ValueType };

    constructor(initialData?:string) 
    {
        if (initialData) this.#lookupTable = this.parseCustomFormat(initialData);
        else this.#lookupTable = {};
    }

    public addKey(key:string, initialValue:ValueType):void 
    {
        this.#lookupTable[key] = initialValue;
    }

    public removeKey(key:string):void 
    {
        if (this.#lookupTable.hasOwnProperty(key)) delete this.#lookupTable[key];
    }

    public getValue<ValueType>(key:string):ValueType | null; 
    public getValue(key:string):ValueType | null 
    {
        if (this.#lookupTable.hasOwnProperty(key)) return this.#lookupTable[key];

        return null;
    }

    public putValue(key:string, value:ValueType):void
    {
        if (!this.#lookupTable.hasOwnProperty(key)) throw new Error('Key does not exist');

        this.#lookupTable[key] = value;
    }

    private parseCustomFormat(input: string): { [key: string]: ValueType } 
    {
        const pairs = input.split(';');
        const lookupTable: { [key: string]: ValueType } = {};

        for (const pair of pairs) 
        {
            const [key, valueWithType] = pair.split(':');

            let result = this.parseSingleValue(valueWithType);
            if (result !== undefined)
            {
                lookupTable[key] = result;
                continue;
            } 

            const arrayValues = valueWithType.slice(1).split(','); //assume it's an array, 'a' type
            lookupTable[key] = arrayValues.map((v: string) => this.parseSingleValue(v));
        }

        return lookupTable;
    }

    private parseSingleValue(valueWithType:string):ValueType 
    {
        const type = valueWithType[0];
        const value = valueWithType.slice(1);
    
        switch(type) 
        {
            case '-':
                return -1;
            case '0':
                return 0;
            case '1':
                return 1;
            case '?':
                return null;
            case 't':
                return true;
            case 'f':
                return false;
            case 's':
                return atob(value);
            case 'n':
                return Number(value);
        } 
        
        throw new Error('invalid type');
    }

    public toString():string 
    {
        const entries = Object.entries(this.#lookupTable);
        const formattedEntries = entries.map(([key, value]) => 
        {
            let typeAndValue:string;
            
            if (Array.isArray(value))
            {
                let arrayValues = value.map((v: ValueType) => this.stringifySingleValue(v));
                typeAndValue = 'a' + arrayValues.join(',');
            }
            else typeAndValue = this.stringifySingleValue(value);
            
            return `${key}:${typeAndValue}`;
        });

        return formattedEntries.join(';');
    }

    private stringifySingleValue(value:ValueType):string 
    {
        switch (value) 
        {
            case -1:
                return '-';
            case 0:
                return '0';
            case 1:
                return '1';
            case null:
                return '?';
            case true:
                return 't';
            case false:
                return 'f';
        }

        switch (typeof value)
        {
            case 'string':
                return 's' + btoa(value);
            case 'number':
                return 'n' + value.toString();       
        }

        throw new Error('Unsupported value type');
    }

    public toJSON():string 
    {
        return JSON.stringify(this.#lookupTable);
    }

    public bytes(): number
    {
        const stringRepresentation = this.toString();
        let byteCount = 0;

        for (let i = 0; i < stringRepresentation.length; i++) 
        {
            const charCode = stringRepresentation.charCodeAt(i);

            if (charCode <= 0x7F) byteCount += 1;
            else if (charCode <= 0x7FF) byteCount += 2;
            else if (charCode <= 0xFFFF) byteCount += 3;
            else byteCount += 4;
        }

        return byteCount;
    }
}
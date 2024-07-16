/**
 * @license		UNLICENSED
 * @date		04.01.2023
 * @copyright   Untitled.io
 * @author      John Brandle
 */

import fs from 'fs-extra';
import path from 'path';

export class HTMLTemplateStringReplacer 
{
    replace($:any, htmlAbsolutePath:string):void
    {
        let preprocessorElements = $('webpack-templatestring');
        
        let vars:Record<string, any> = {};
        for (let i = preprocessorElements.length; i--;)
        {
            let element = $(preprocessorElements[i]);
    
            let src = element.attr('src');
            let name = element.attr('name');
            let value = element.attr('value') || '';
    
            //console.log(htmlAbsolutePath, src);
            let configPath = path.join(htmlAbsolutePath, src);
            //console.log(configPath);
            let json = fs.readJSONSync(configPath);

            let parts = value.split('.');
            while (parts.length)
            {
                let name = parts.shift();
                if (!name) continue;
    
                json = json[name];
            }
            vars[name] = json;
    
            element.remove();
        }

        this.replaceHtmlVariables($, vars);
    }
    
    replaceHtmlVariables($:any, data:Record<string, any>) //find all nodes containing "${}" strings
    {
        const variableRegex = /(\$\{[\w._]+\})/g;
      
        let array = $('*');
        for (let i = array.length; i--;) 
        {
            const node = $(array[i]);
            
            const attributes = node.get(0).attribs;
            Object.keys(attributes).forEach((attr) => //iterate over all attributes of the node
            {
                const attrValue = attributes[attr];
      
                if (!variableRegex.test(attrValue)) return; //abort if the attribute does not contain "${}"
                
                const replacedValue = attrValue.replace(variableRegex, (match:string, path:string) => 
                {
                    const propertyValue = this.getPropertyByPath(data, path.trim()); //get the property value from the data object using the path
    
                    if (propertyValue === undefined) console.error('invalid: ' + path);
                    
                    return propertyValue !== undefined ? propertyValue : ''; //return the property value or an empty string if not found
                });
                
                node.attr(attr, replacedValue); //update the attribute value with the replaced value
            });
      
            const text = node.text();
            if (!variableRegex.test(text)) continue; //check if the node's text contains "${}"
            
            const replacedText = text.replace(variableRegex, (match:string, path:string) => 
            {
                const propertyValue = this.getPropertyByPath(data, path.trim()); //get the property value from the data object using the path
                if (propertyValue === undefined) console.error('invalid: ' + path);
      
                return propertyValue !== undefined ? propertyValue : ''; //return the property value or an empty string if not found  
            });
      
            //update the node's text with the replaced value
            //create a new string representation of the modified node
            const newNodeString = `<${node.get(0).tagName}${this.getAttributesString(node)}>${replacedText}</${node.get(0).tagName}>`;
      
            //replace the original node with the new node string
            node.replaceWith(newNodeString);
      
            this.replaceHtmlVariables($, data);
        }
    }
    
    getAttributesString(node:any) 
    {
        const attributes = node.get(0).attribs;
        return Object.keys(attributes).map((attr) => 
        {
            const value = attributes[attr];
            return ` ${attr}="${value}"`;
        }).join('');
    }
    
    getPropertyByPath(object:any, path:string) 
    {
        path = path.substring(2, path.length - 1);

        const keys = path.split('.');
        let value = object;
    
        for (const key of keys) 
        {
            const previousValue = value;
            value = value[key];
    
            if (value === undefined) 
            {
                console.log(JSON.stringify(previousValue, null, 4));
                console.error('could not find key: ' + key + ' for template string: ' + path);
                break;
            }
        }
    
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value.toString();
        if (!value) return value;
        
        return JSON.stringify(value).trim();
    }
}
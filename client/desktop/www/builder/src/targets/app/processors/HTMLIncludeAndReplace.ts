/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import path from 'path';
import fs from 'fs-extra';
import cheerio, { type CheerioAPI } from 'cheerio';

export class HTMLIncludeAndReplaceProcessor 
{
    constructor()
    {
    }

    static process = async ($:CheerioAPI, loaderContext:any) =>
    {
        const includeAttributeName = '__include';
        const replaceAttributeName = '__replace';
    
        //start the processing queue with the root element of the document
        const filesToProcess:Array<any> = [{ content: $(':root'), dirname: path.dirname(loaderContext.resourcePath) }];
    
        //while there are still elements left to process
        while (filesToProcess.length > 0) 
        {
            //retrieve and remove the first element from the queue
            const { content, dirname } = filesToProcess.shift();
    
            //find elements with the '__include' and '__replace' attributes
            let elementsWith__include = content.find(`[${includeAttributeName}]`);
            let elementsWith__replace = content.find(`[${replaceAttributeName}]`);
    
            //process all elements with '__include' attribute
            for (let i = 0; i < elementsWith__include.length; i++)
            {
                let element = $(elementsWith__include[i]);
                let file = path.join(dirname, element.attr(includeAttributeName)!);
    
                //replace the content of the element with the content of the included file
                let fileContent = await fs.readFile(file, 'utf8');
                element.html(fileContent);
                element.removeAttr(includeAttributeName);
    
                //add the included content to the processing queue
                filesToProcess.push({ content: element, dirname: path.dirname(file) });
            }
    
            //process all elements with '__replace' attribute
            for (let i = 0; i < elementsWith__replace.length; i++)
            {
                let element = $(elementsWith__replace[i]);
                let file = path.join(dirname, element.attr(replaceAttributeName)!);
                let fileContent = await fs.readFile(file, 'utf8');
    
                //check if the content of the file contains a single root element
                let tempElement = cheerio.load(fileContent).root();
                if (tempElement.children().length !== 1) 
                {
                    throw new Error(`The file content for replacement must consist of a single root element. File: ${file}`);
                }
    
                //replace the element with the content of the file
                let parent = element.parent();
                let index = element.index();
                element.replaceWith(fileContent);
    
                //add the new element to the processing queue
                let newElement = parent.children().eq(index);
                filesToProcess.push({ content: newElement, dirname: path.dirname(file) });
            }
        }
    }
}
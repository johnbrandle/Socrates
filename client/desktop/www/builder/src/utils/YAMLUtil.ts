/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import fs from 'fs-extra';
import path from 'path';
import jsYaml from 'js-yaml';
import { FileUtil } from './FileUtil';

export class YAMLUtil 
{
    static yamlToJSON = (dir:string):Array<[string, string]> => 
    {
        let results:Array<[string, string]> = [];

        const convertYamlFileToJson = (yamlFilePath:string) => 
        {
            try 
            {
                const data = fs.readFileSync(yamlFilePath, 'utf8');
                return jsYaml.load(data);
            } 
            catch (err) 
            {
                console.error(`Error parsing YAML file ${yamlFilePath}: ${err}`);
                return null;
            }
        }

        const files = FileUtil.getFilesWithExtension(dir, '.yaml');
    
        files.forEach((yamlFilePath:string) => 
        {
            const jsonData = convertYamlFileToJson(yamlFilePath);
        
            if (!jsonData) return; 
            
            const jsonFilePath = path.join(path.dirname(yamlFilePath), path.basename(yamlFilePath, '.yaml') + '.json');
                
            results.push([jsonFilePath, JSON.stringify(jsonData)]);

            console.log(`Converted ${yamlFilePath} to JSON`);
        });
    
        return results;
    }
}
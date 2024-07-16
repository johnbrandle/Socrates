/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import fs from 'fs-extra';
import path from 'path';
import micromatch from 'micromatch';

export class FileUtil 
{
    public static wasModified = (filepath:string, data:string) =>
    {
        let exists = fs.existsSync(filepath);
    
        if (!exists) return true;
        
        let data2 = fs.readFileSync(filepath, 'utf8');
        return data !== data2;
    }
    
    public static writeIfModified = (filepath:string, data:string) =>
    {
        if (!this.wasModified(filepath, data)) return;
        
        fs.writeFileSync(filepath, data, {encoding:'utf8'});
        
        console.log("Wrote: " + filepath);
    }

    public static getFilesWithExtension = (dirPath:string, extension:string) => 
    {
        let files:Array<string> = [];
    
        const dirents = fs.readdirSync(dirPath, { withFileTypes: true });
    
        for (const dirent of dirents) 
        {
            const filePath = path.join(dirPath, dirent.name);
            if (dirent.isDirectory()) 
            {
                if (dirent.name === 'node_modules') continue;
                
                const nestedFiles = this.getFilesWithExtension(filePath, extension);
                files = files.concat(nestedFiles);
                continue;
            } 
            
            if (path.extname(dirent.name).toLowerCase() === extension.toLowerCase()) files.push(filePath);
        }
    
        return files;
    }
    
    public static copyContentsTo(fromPath:string, toPath:string, exclude:Array<string>):void 
    {
        //ensure the destination directory exists.
        fs.ensureDirSync(toPath);

        //read the source directory.
        const entries = fs.readdirSync(fromPath, { withFileTypes: true });

        //iterate over each entry.
        for (const entry of entries) 
        {
            const sourcePath = path.join(fromPath, entry.name);
            const destinationPath = path.join(toPath, entry.name);
            const relativeSourcePath = path.relative(fromPath, sourcePath);

            //check if current path matches any pattern in the exclude array
            if (micromatch.isMatch(relativeSourcePath, exclude)) continue;
            
            //copy file if it's not a directory.
            if (entry.isFile()) 
            {
                if (!fs.existsSync(destinationPath) || fs.readFileSync(sourcePath) !== fs.readFileSync(destinationPath)) fs.copyFileSync(sourcePath, destinationPath);
            }
            else if (entry.isDirectory()) this.copyContentsTo(sourcePath, destinationPath, exclude); //recurse into directory.
        }
    }

    
    public static convertBackslashesToForwardSlashes = (path:string):string => path.replace(/\\/g, '/');
}
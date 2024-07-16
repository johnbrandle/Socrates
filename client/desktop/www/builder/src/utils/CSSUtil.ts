/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import fs from 'fs-extra';
import path from 'path';
import CleanCSS from 'clean-css';
import { FileUtil } from './FileUtil';

export class CSSUtil 
{
    public static minifyCSS = (dir:string) => 
    {
        const files = fs.readdirSync(dir);
        for (const file of files) 
        {
            const filepath = path.join(dir, file);
            const stat = fs.statSync(filepath);
            if (stat.isDirectory()) this.minifyCSS(filepath);  //recursively process subdirectories
            else if (path.extname(filepath) === '.css' && !file.endsWith('.min.css')) 
            {
                const data = fs.readFileSync(filepath, 'utf8');
                const minified = this.minify(data);
                const minifiedFilePath = path.join(path.dirname(filepath), path.basename(filepath, '.css') + '.min.css');
                
                FileUtil.writeIfModified(minifiedFilePath, minified);
            }
        }
    }

    public static minify = (css:string) => 
    {
        return new CleanCSS().minify(css).styles;
    }
}
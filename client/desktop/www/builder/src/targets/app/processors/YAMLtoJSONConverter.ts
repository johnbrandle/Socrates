/**
 * @license		UNLICENSED
 * @date		04.01.2023
 * @copyright   Untitled.io
 * @author      John Brandle
 */

import { FileUtil } from '../../../utils/FileUtil';
import { YAMLUtil } from '../../../utils/YAMLUtil';

export class YAMLtoJSONConverter
{
    convert(path:string)
    {
        let results = YAMLUtil.yamlToJSON(path);
        results.forEach(result => FileUtil.writeIfModified(result[0], result[1]));
    }
}
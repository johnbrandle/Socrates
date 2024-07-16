/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
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
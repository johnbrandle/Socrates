import { createSHA256 } from "hash-wasm";
import type { HashOutputFormat, hex_256 } from "../../../../../../../shared/src/library/utils/HashUtil";

const sha256 = await createSHA256();

export const __hashSHA256 = (input:string | Uint8Array, format:HashOutputFormat):hex_256 | Uint8Array => //compares well to async method so long as the byte length is small
{   
    sha256.update(input as string | Uint8Array);
    
    const data = format === 'hex' ? sha256.digest('hex') as hex_256 : sha256.digest('binary');

    sha256.init(); //initing after, rather than before, so the sensitive data is cleared from memory

    return data;
}
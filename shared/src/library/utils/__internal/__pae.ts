/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 * @important ALL changes to this code and dependant code must be well tested!
 */

import type { PAE } from "../HMACUtil";

export const __derivePAE = (dataArrays:Uint8Array[]):PAE =>
{
    if (dataArrays.length === 0) new Error('At least one data array must be provided');

    let totalDataLength = 0;
    const lengthsArray = new Uint8Array(dataArrays.length * 8); //allocate 8 bytes for the length of each input array

    //use a DataView to facilitate setting 64-bit length values
    const lengthsView = new DataView(lengthsArray.buffer);

    //calculate total length of data and prepare lengths array
    let index = 0;
    for (const dataArray of dataArrays) 
    {
        totalDataLength += dataArray.length; //sum up the total length of all data
        lengthsView.setBigUint64(index * 8, BigInt(dataArray.length), true); //store length as 64-bit value
        index++;
    }

    //create a new array to hold the lengths and all input data
    const result = new Uint8Array(lengthsArray.length + totalDataLength);
    result.set(lengthsArray, 0); //set the lengths at the beginning

    let offset = lengthsArray.length; //offset to start copying input data after the lengths
    for (const dataArray of dataArrays) 
    {
        result.set(dataArray, offset);
        offset += dataArray.length; //move the offset for the next array
    }

    return result as PAE; //the result is a single Uint8Array containing all lengths followed by all input data
}
/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export enum VideoTranscodeTask
{
    transcode = 'transcode'
}

export enum VideoThumbnailTask
{
    generateThumbnail = 'generateThumbnail'
}

export type Info = {width:number, height:number, duration:number, bitrate:number, fps:number};
export enum VideoInfoTask
{
    getInfo = 'getInfo'
}

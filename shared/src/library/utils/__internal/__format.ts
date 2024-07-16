/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export const __format = (template:string, args:ArrayLike<any>):string =>
{
    let index = 0;
    let string = template.replace(/{.*?}/g, (match) => args[index++] !== undefined ? args[index - 1].toString() : match);
    if (index < args.length) string += Array.from(args).slice(index).join(', ');

    return string;
}

export const __format2 = (template:string, args:ArrayLike<any>):[string, remainingArgs:any[]] =>
{
    let index = 0;
    let string = template.replace(/{.*?}/g, (match) => args[index++] !== undefined ? args[index - 1].toString() : match);
    if (index < args.length) return [string, Array.from(args).slice(index)];

    return [string, []];
}
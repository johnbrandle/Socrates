module.exports = function(source, sourceMap) 
{
    const doReplace = (className, name, doThrow) =>
    {
        let index = 0;
        while ((index = source.indexOf(` ${className}.${name}`, index)) !== -1) 
        {
            let count = 0;
            let endIndex = index;
            let inArguments = false;
            let lineEndIndex = source.indexOf('\n', index);
            let isMultiLine = false;

            // If no newline is found, set the line end index to the end of the source
            if (lineEndIndex === -1) lineEndIndex = source.length;
            
            while (endIndex < lineEndIndex) 
            {
                const char = source[endIndex];
                if (char === '(') 
                {
                    count++;
                    inArguments = true;
                } 
                else if (char === ')') 
                {
                    count--;
                    if (count === 0 && inArguments) break;
                } 
                else if (char === '\n') 
                {
                    // If a newline is encountered in the arguments, it's a multi-line call
                    isMultiLine = true;
                    break;
                }
                endIndex++;
            }

            if (inArguments && !isMultiLine) 
            {
                // Capture the full Error.throw call including the semicolon
                const fullMatch = source.substring(index, endIndex + 1);
                const args = fullMatch.slice(` ${className}.${name}(`.length, -1);
                const replacement1 = `(globalThis.errorToThrow=${className}.${name}(${args}), (() => { debugger; throw globalThis.errorToThrow; })());`;
                const replacement2 = `(${className}.${name}(${args}), (() => { debugger; })());`;

                const replacement = doThrow ? replacement1 : replacement2;

                // Append any remaining text on the line (including comments)
                const remainingLineText = source.substring(endIndex + 2, lineEndIndex);
                source = source.substring(0, index) + replacement + remainingLineText + source.substring(lineEndIndex);
            } else if (isMultiLine) throw new Error(`Multi-line '${className}.${name}' patterns are not supported.`);

            index = lineEndIndex + 1;
        }
    };

    //doReplace('Error', 'throw', true);
    //doReplace('Error', 'rethrow', true);
    //doReplace('Error', 'warn');

    //doReplace('CorrectableError', 'throw');

    if (sourceMap) 
    {
        this.callback(null, source, sourceMap);
        return;
    }

    return source;
};

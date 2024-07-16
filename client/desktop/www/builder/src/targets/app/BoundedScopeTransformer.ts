const ts = require("typescript");

function hasJsdocTag(node:any, tagName:any) 
{
    if (!node.jsDoc) return false;
    for (let jsdoc of node.jsDoc) 
    {
        for (let tag of jsdoc.tags || []) 
        {
            if (tag.tagName.escapedText === tagName) return true;
        }
    }
    return false;
}

function hasThisKeyword(node:any):boolean 
{
    if (node.kind === ts.SyntaxKind.ThisKeyword) return true;

    return ts.forEachChild(node, hasThisKeyword);
}

class BoundedScopeTransformer 
{
    _program:any;
    _context:any;

    constructor(program:any) 
    {
        this._program = program;
    }

    #visitNode = (node:any):any =>
    {
        let forceCheckOnAllMethods = false;

        if (ts.isClassDeclaration(node)) 
        {
            if (hasJsdocTag(node, "boundedScopeTransformer_force")) 
            {
                forceCheckOnAllMethods = true;
            }

            node.members.forEach((member: any) => 
            {
                if (ts.isMethodDeclaration(member) && (forceCheckOnAllMethods || hasJsdocTag(member, "boundedScopeTransformer_force"))) 
                {
                    if (member.body && ts.isArrowFunction(member.body)) 
                    {
                        //method is an arrow function, so it's fine
                        return;
                    }
                    if (!hasThisKeyword(member)) 
                    {
                        //method does not use 'this', so it's fine
                        return;
                    }
                    
                    throw new Error(`Method ${member.name.escapedText} in ${node.name.escapedText} violates bounded scope rules.`);
                }
            });
        }

        return ts.visitEachChild(node, this.#visitNode, this._context);
    }

    visitSourceFile(context:any, fileNode:any) 
    {
        this._context = context;
        return ts.visitNode(fileNode, this.#visitNode);
    }
}

export default (program:any) => 
{
    let transformer = new BoundedScopeTransformer(program);
    return (context:any) => (node:any) => transformer.visitSourceFile(context, node);
}
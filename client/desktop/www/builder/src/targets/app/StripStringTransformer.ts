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

class StripStringTransformer 
{
    _program:any;
    _context:any;

    _shouldStrip:boolean = false;

    constructor(program:any) 
    {
        this._program = program;
    }

    #visitNode(node: any): any 
    {
        const replace = (objectLiteralExpression:any):void =>
        {
            objectLiteralExpression.properties.forEach((property: any, index:number) => 
            {
                if (ts.isPropertyAssignment(property)) property.initializer = ts.factory.createStringLiteral(String(index));
            });
        }    


        if (ts.isClassDeclaration(node)) 
        {
            const newMembers = node.members.map((member: any) => 
            {
                if (ts.isPropertyDeclaration(member) && hasJsdocTag(member, "stripStringTransformer_strip")) 
                {
                    if (ts.isObjectLiteralExpression(member.initializer)) replace(member.initializer);
                }                
            });
        }
        else if (hasJsdocTag(node, "stripStringTransformer_strip") && ts.SyntaxKind[node.kind] === 'FirstStatement') this._shouldStrip = true; 
        else if (this._shouldStrip && ts.isVariableDeclaration(node)) 
        {
            this._shouldStrip = false;

            if (ts.isObjectLiteralExpression(node.initializer)) replace(node.initializer);
        }
                
        return ts.visitEachChild(node, this.#visitNode.bind(this), this._context);
    }
    
    
    visitSourceFile(context:any, fileNode:any) 
    {
        this._context = context;

        return ts.visitNode(fileNode, this.#visitNode.bind(this));
    }
}

export default (program:any) =>
{
    let transfomer = new StripStringTransformer(program);

    return (context:any) => (node:any) => transfomer.visitSourceFile(context, node);
}

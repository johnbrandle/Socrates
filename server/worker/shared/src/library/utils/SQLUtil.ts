/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IApp } from "../../app/IApp";

export class SQLUtil<A extends IApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public createInsertStatement(d1:D1Database, tableName:string, data:Array<[string, any]>):D1PreparedStatement
    {
        let columnNames:string[] = [];
        let values:any[] = [];
      
        let placeholders:string[] = [];
      
        for (let i = 0, length = data.length; i < length; i++) 
        {
            let each = data[i];
    
            columnNames.push(each[0]);
            values.push(each[1]);
    
            placeholders.push(`?${i + 1}`);
        }
    
        let sql = `INSERT INTO ${tableName} (${columnNames.join(", ")}) VALUES (${placeholders.join(", ")})`;

        return d1.prepare(sql).bind(...values);
    }

    public createUpdateStatement(d1:D1Database, tableName:string, id:[string, any], data:Array<[string, any]>):D1PreparedStatement
    {
        let columnUpdates:string[] = [];
        let values:any[] = [];
    
        for (let i = 0, length = data.length; i < length; i++) 
        {
            let each = data[i];
    
            columnUpdates.push(`${each[0]} = ?${i + 1}`);
            values.push(each[1]);
        }
    
        //add the ID value at the end of the values array
        values.push(id[1]);
    
        let sql = `UPDATE ${tableName} SET ${columnUpdates.join(", ")} WHERE ${id[0]} = ?${values.length}`;
    
        return d1.prepare(sql).bind(...values);
    }

    public createDeleteStatement(d1:D1Database, tableName:string, id:[string, any]):D1PreparedStatement
    {
        let sql = `DELETE FROM ${tableName} WHERE ${id[0]} = ?1`;
    
        return d1.prepare(sql).bind(id[1]);
    }
}
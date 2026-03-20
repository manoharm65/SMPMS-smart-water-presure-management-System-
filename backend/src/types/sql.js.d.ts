declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: any[]): Database;
    exec(sql: string, params?: any[]): QueryExecResult[];
    getRowsModified(): number;
    export(): Uint8Array;
    close(): void;
  }

  export default function initSqlJs(config?: any): Promise<SqlJsStatic>;
}

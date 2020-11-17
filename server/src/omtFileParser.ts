import * as fs from "fs";
import { CheckFileResult, CheckTextResult } from "./types";

// pattern capturing only the name of the declaration
const moduleNamePattern = /^moduleName: (\w+)(?:\s#.*)?$/;

export function parseOmtText(text: string): CheckTextResult {
    const match = new RegExp(moduleNamePattern, 'gm').exec(text);
    return match ? 
         {
            module: {
                name: match[1]
            }
        } : { };
}

/**
 * Reads a file from the filesystem and returns a information about the omt
 * @param uri the path to the file
 */
export function parseOmtFile(uri: string): Promise<CheckFileResult> {
    return new Promise((resolve, reject) => {
        fs.readFile(uri, 'utf-8', (err, data) => {
            if (err) {
                reject(err);
            } else {
                const result: CheckFileResult = {
                    path: uri,
                    ...parseOmtText(data)
                };
                resolve(result);
            }
        });
    });
}

import * as fs from "fs";

// pattern capturing only the name of the declaration
const moduleNamePattern = /^moduleName: (\w+)\s?$/;

export function parseOmtText(text: string): CheckTextResult {
    const match = new RegExp(moduleNamePattern, 'gm').exec(text);
    return {
        moduleName: match ? match[1] : undefined,
        isModule: !!match
    }
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

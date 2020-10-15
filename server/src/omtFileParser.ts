import { readFile } from "fs";

export function parseOmtText(text: string): CheckTextResult {
    const match = new RegExp(/^moduleName: (\w+)\s?$/, 'gm').exec(text);
    return {
        moduleName: match ? match[1] : undefined,
        isModule: !!match
    }
}

export function parseOmtFile(uri: string): Promise<CheckFileResult> {
    return new Promise((resolve, reject) => {
        readFile(uri, 'utf-8', (err, data) => {
            if (err) {
                console.error(`failed during reading ${uri}`, err);
                reject(err);
            }
            const result: CheckFileResult = {
                path: uri,
                ...parseOmtText(data)
            };
            resolve(result);
        })
    });
}

import { Range } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { OmtAvailableObjects, OmtImport, OmtLocalObject } from './types';
import { parse } from 'yaml';
import { getUriMatch } from './importMatch';

/**
 * A function that can be used to retrieve all imported and declared objects (objects available to use)
 * @param document the TextDocument object
 * @param shorthands a list of shorthands that should be replaced by a full url
 * @returns an OmtAvailableObjects object, containing a list of imported objects and declared objects
 */
export function getAvailableObjectsFromDocument(document: TextDocument, shorthands?: Map<string, string>): OmtAvailableObjects {
    const documentText = document.getText();
    const yamlDocument = parse(document.getText()) ?? {};
    const availableImports: OmtImport[] = [];
    const definedObjects: OmtLocalObject[] = [];
    if (yamlDocument["import"] && shorthands) {
        const documentImports = yamlDocument["import"];
        const importUrls = Object.keys(documentImports);
        importUrls.forEach(importUrl => {
            const imports: string[] = documentImports[importUrl] ?? [];
            const uriMatchResult = getUriMatch(' ' + importUrl, document, shorthands);
            imports.forEach(importName => {
                availableImports.push({ name: importName, url: importUrl, fullUrl: uriMatchResult });
            });
        });
    }
    if (yamlDocument["queries"]) {
        definedObjects.push(...findDefinedObjects(yamlDocument["queries"], documentText, "QUERY"));
    }
    if (yamlDocument["commands"]) {
        definedObjects.push(...findDefinedObjects(yamlDocument["commands"], documentText, "COMMAND"));
    }
    if (yamlDocument["model"]) {
        const modelEntries = yamlDocument["model"];
        definedObjects.push(...findModelEntries(modelEntries, documentText));
        const keys = Object.keys(modelEntries);
        keys.forEach(key => {
            const entry = modelEntries[key];

            try {
                if ("commands" in entry) {
                    definedObjects.push(...findDefinedObjects(entry["commands"], documentText, "COMMAND"));
                }

                if ("queries" in entry) {
                    definedObjects.push(...findDefinedObjects(entry["queries"], documentText, "QUERY"));
                }
            } catch(error) {
                if(error instanceof TypeError && error.message.includes("Cannot use 'in' operator")) {
                    console.log(error);
                } else {
                    throw error;
                }
            }
        });
    }
    return { availableImports, definedObjects };
}

/**
 * A function to get all declared objects in ODT code
 * @param value a piece of text that contains (multiline) ODT code
 * @param documentText the text of the document, used to find the line numbers
 * @param define the thing we define, something like QUERY or COMMAND
 * @returns A list of OmtLocalObject with the range where the declared object can be found in the document
 */
function findDefinedObjects(value: string, documentText: string, define: string): OmtLocalObject[] {
    const localDefinedObjects: OmtLocalObject[] = [];
    const queriesRegex = new RegExp(`(?<=DEFINE ${define} )([a-zA-Z0-9_-]+)`, "gm");
    const definedQueries = value.match(queriesRegex);
    definedQueries && definedQueries.forEach(q => {
        const rangeForQuery = findRangeWithRegex(documentText, new RegExp(`(?<=DEFINE ${define} )(${q})(?=[^a-zA-Z0-9_-])`, "gm"))
        const getParametersRegex = new RegExp(`DEFINE ${define} ${q} *(((?<parameters>.*)))? *=>`, "gm");
        const parameters = getParametersRegex.exec(documentText);
        localDefinedObjects.push({ name: q, range: rangeForQuery, parameters: trimAndSplitParameterString(parameters?.groups?.parameters) })
    });

    return localDefinedObjects;
}

function trimAndSplitParameterString(parameters?: string) {
    if(!parameters) {
        return [];
    }
    return parameters.replace(/[() ]/gm, '').split(",");
}

/**
 * This function assumes that the regex is found only once in the document, and returns the Range where it can be found.
 * @param documentText the text of the document, used to find the line numbers
 * @param regex the regex which we are trying to find
 * @returns A range where the regex can be found, or an error if the regex is found zero or more than one times.
 */
function findRangeWithRegex(documentText: string, regex: RegExp): Range {
    const lines = documentText.split(/\r?\n/);
    const ranges: Range[] = [];

    lines.forEach((line, i) => {
        const result = line.match(regex);
        if (result) {
            const name = result[0];
            const index = line.indexOf(name);
            ranges.push(Range.create({ line: i, character: index }, { line: i, character: index + name.length }));
        }
    });

    if (ranges.length !== 1) {
        throw new Error(`${ranges.length} results found for ${regex}, expected only one.`);
    }

    return ranges[0];
}

/**
 * A function to get all declared activities/procedures etc.
 * @param modelEntries the result of yamlDocument["model"]
 * @param documentText the text of the document, used to find the line numbers
 * @returns A list of OmtLocalObject with the range where the declared object can be found in the document
 */
function findModelEntries(modelEntries: Record<string, unknown>, documentText: string): OmtLocalObject[] {
    const localDefinedObjects: OmtLocalObject[] = [];
    const keys = Object.keys(modelEntries);
    keys.forEach(key => {
        const range = findRangeWithRegex(documentText, new RegExp(`(?<= +)(${key})(?=: !)`));
        let parameters: string[] = [];
        if(instanceWithParams(modelEntries[key])) {
            parameters = (modelEntries[key] as ObjectWithParams).params;
        }
        localDefinedObjects.push({ name: key, range, parameters });
    });
    return localDefinedObjects;
}

interface ObjectWithParams {
    params: string[];
}

function instanceWithParams(object: unknown): object is ObjectWithParams {
    return (object as ObjectWithParams).params !== undefined;
}

/**
 * Used to export some functions that will be tested (but not exported for usage)
 */
export const exportedForTesting = {
    findDefinedObjects,
    findModelEntries,
    findRangeWithRegex,
    instanceWithParams,
    trimAndSplitParameterString,
}
import * as fs from "fs";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position, Range } from "vscode-languageserver/node";
import OmtDocumentInformationProvider from "./omtDocumentInformationProvider";
import { OmtAvailableObjects, OmtLocalObject } from "./types";

/**
 * A function that returns 1 if pos1 is after pos2, -1 is pos1 is before pos2 and 0 if they are equal
 * @param pos1 
 * @param pos2 
 * @returns 
 */
export function comparePositions(pos1: Position, pos2: Position): number {
    if (pos1.line !== pos2.line) {
        return pos1.line > pos2.line ? 1 : -1;
    }
    if (pos1.character !== pos2.character) {
        return pos1.character > pos2.character ? 1 : -1;
    }
    return 0;
}

/**
 * A function that returns whether the position falls in the range
 * @param position 
 * @param range 
 * @returns 
 */
export function positionInRange(position: Position, range: Range): boolean {
    return (
        comparePositions(range.start, position) <= 0 &&
        comparePositions(position, range.end) <= 0
    );
}

/**
 * Returns a list of the result of callbackfn, where callbackfn is applied for each found available object.
 * @param omtDocumentInformationProvider used for getting document information for imported files
 * @param linkUrl url to the document
 * @param availableObjects used to find the definition for the link
 * @param link the OmtLocalObject which needs to be found in availableObjects
 * @param callbackfn A function that accepts two arguments. forEachAvailableObjectForLink calls the function callbackfn for each available object which name corresponds with the provided link.
 */
export function forEachAvailableObjectForLink<Type>(
    omtDocumentInformationProvider: OmtDocumentInformationProvider,
    linkUrl: string,
    availableObjects: OmtAvailableObjects,
    link: OmtLocalObject,
    callbackfn: (linkUrl: string, omtLocalObject: OmtLocalObject) => Type
): Type[] {
    const results: Type[] = [];
    availableObjects.definedObjects
        .filter((o) => o.name === link.name)
        .forEach((o) => {
            results.push(callbackfn(linkUrl, o));
        });
    availableObjects.availableImports
        .filter((i) => i.name === link.name)
        .forEach((i) => {
            results.push(...forEachAvailableObjectForLinkInImportedFile(omtDocumentInformationProvider, i.fullUrl, link, callbackfn));
        });
    return results;
}

/**
 * Returns a list of the result of callbackfn, where callbackfn is applied for each found available object. A linkUrl is provided to read the file and getting the available objects.
 * @param omtDocumentInformationProvider used for getting document information for imported files
 * @param linkUrl url to the document
 * @param link the OmtLocalObject which needs to be found in the document
 * @param callbackfn A function that accepts two arguments. forEachAvailableObjectForLink calls the function callbackfn for each available object which name corresponds with the provided link.
 */
function forEachAvailableObjectForLinkInImportedFile<Type>(
    omtDocumentInformationProvider: OmtDocumentInformationProvider,
    linkUrl: string,
    link: OmtLocalObject,
    callbackfn: (linkUrl: string, omtLocalObject: OmtLocalObject) => Type
): Type[] {
    const otherDocument = TextDocument.create(
        linkUrl,
        "omt",
        1,
        fs.readFileSync(linkUrl).toString()
    );
    if (otherDocument) {
        const availableObjects =
            omtDocumentInformationProvider.provideAvailableObjectsFromDocument(
                otherDocument
            );
        return forEachAvailableObjectForLink(omtDocumentInformationProvider, linkUrl, availableObjects, link, callbackfn);
    }
    return [];
}

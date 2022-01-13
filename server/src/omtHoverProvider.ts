import { Hover, HoverParams } from "vscode-languageserver/node";
import OmtDocumentInformationProvider from "./omtDocumentInformationProvider";
import { forEachAvailableObjectForLink, positionInRange } from "./position";
import { OmtDocumentInformation, OmtLocalObject } from "./types";

export function getHoverInformationForPosition(
    omtDocumentInformationProvider: OmtDocumentInformationProvider,
    params: HoverParams,
    omtDocumentInformation: OmtDocumentInformation
): Hover | undefined {
    const hovers: Hover[] = [];
    omtDocumentInformation.calledObjects
        .filter((link) => positionInRange(params.position, link.range))
        .forEach((link) => {
            const omtLocalObjectToHoverObject = (
                _: string,
                omtLocalObject: OmtLocalObject
            ) => ({
                contents: {
                    kind: "plaintext",
                    language: "omt",
                    value:
                        omtLocalObject.name +
                        "(" +
                        omtLocalObject.parameters?.join(", ") +
                        ")",
                },
            });
            hovers.push(
                ...forEachAvailableObjectForLink(
                    omtDocumentInformationProvider,
                    params.textDocument.uri,
                    omtDocumentInformation,
                    link,
                    omtLocalObjectToHoverObject
                )
            );
        });
    if (hovers.length === 1) {
        return hovers[0];
    }
    return undefined;
}

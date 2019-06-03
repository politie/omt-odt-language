
import { languages, ExtensionContext, Disposable } from 'vscode';
import OMTLinkProvider from './provider';

export function activate(context: ExtensionContext) {
    const provider = new OMTLinkProvider();

    // register document link provider for 'omt' files
    const providerRegistrations = Disposable.from(
        languages.registerDocumentLinkProvider({ scheme: 'file', language: 'omt' }, provider)
    );

    context.subscriptions.push(
        provider,
        providerRegistrations
    );
}
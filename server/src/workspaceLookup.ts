import { WorkspaceFolder, TextDocument, RemoteWorkspace } from 'vscode-languageserver'
import { OMTModule } from './omtModule';

/**
 * Tracks changes to the workspace and important files for core functionality of the language server
 */
export class WorkspaceLookup {
    private folders: Map<string, WorkspaceFolder>;

    /**
     *
     * @param workspace workspace of the client
     */
    constructor(private workspace: RemoteWorkspace) {
        this.folders = new Map<string, WorkspaceFolder>();

        workspace.getWorkspaceFolders().then((folders) => {
            if (folders) {
                folders.forEach(folder => this.addFolder(folder));
            }
        });

        workspace.onDidChangeWorkspaceFolders(event => {
            event.added.forEach(folder => this.addFolder(folder));
            event.removed.forEach(folder => this.removeFolder(folder));
        });
    }

    public addFolder(folder: WorkspaceFolder) {
        if (this.folders.get(folder.uri)) {
            throw new Error('workspace folder was already added');
        }
        else {
            this.folders.set(folder.uri, folder);
        }
    }

    public removeFolder(folder: WorkspaceFolder) {
        if (!this.folders.delete(folder.uri)) {
            throw new Error('workspace folder was already removed')
        }
    }

    public addFile() {
        // check if it is a module
        throw new Error('workplaceLookup.addFile: Not Implemented');
    }

    public deleteFile() {
        throw new Error('workplaceLookup.deleteFile: Not Implemented');
    }

    /* Find all configurations applicable to a path */
    public findConfigPaths(fromPath: string): TextDocument[] {
        throw new Error('workplaceLookup.findConfigPaths: Not Implemented');
    }

    private scanForConfigs() {

    }

    public scanForOMTModules(): OMTModule[] {
        console.log('scan for omt modules');
        return [];
        // throw new Error('workplaceLookup.scanForOMTModules: Not Implemented');
    }

    getModuleElementUri(module: string, elementName: string): string {
        return '';
        // throw new Error('Method not implemented.');
    }

    getModuleUri(declaredImportModule: string): string {
        return '';
        // throw new Error('Method not implemented.');
    }
}

import { CheckFileResult, OMTModule } from "./types";

export interface WorkspaceProcessor {
    readonly extention: string;
    checkForChanges: (result: CheckFileResult) => void;
    removeFolder: (uri: string) => void;
}

export class WorkspaceModules implements WorkspaceProcessor {
    readonly extention = '.omt';
    /**
     * modules, keyed by name
     */
    modules = new Map<string, OMTModule>();

    checkForChanges(result: CheckFileResult) {
        if (result.module && result.module.name) {
            const module = this.modules.get(result.module.name);
            if (!module) {
                this.modules.forEach((value, key) => {
                    if (value.uri == result.path) {
                        this.modules.delete(key);
                    }
                });
            }
            this.processModule({
                ...result.module,
                uri: result.path
            });
        } else {
            // remove if this file was considered a module and now no longer matches
            this.modules.forEach(module => {
                if (module.uri === result.path) {
                    this.modules.delete(module.name);
                }
            });
        }
    }

    private processModule(moduleResult: OMTModule) {
        const { name, uri } = moduleResult;
        if (!name) {
            throw new Error('name is undefined');
        }
        const existing = this.modules.get(name);
        if (existing && existing.uri != uri) {
            console.warn(`WARN: There is another module named '${existing.name}' found at ${existing.uri}. Will now replace with ${uri}`);
        }
        this.modules.set(name,
            {
                name,
                uri,
            });
    }

    getModulePath(name: string): string | undefined {
        const module = this.modules.get(name);
        return module?.uri;
    }

    removeFolder(uri: string) {
        this.modules.forEach(module => {
            if (module.uri.startsWith(uri)) {
                this.modules.delete(module.name);
            }
        });
    }

    removeFile(uri: string) {
        this.modules.forEach(module => {
            if (module.uri == uri) {
                this.modules.delete(module.name);
            }
        });
    }
}

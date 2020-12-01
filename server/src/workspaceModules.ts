import { CheckFileResult, OMTModule } from "./types";
export class WorkspaceModules {
    /**
     * modules, keyed by name
     */
    modules = new Map<string, OMTModule>();
    /**
     * Use a `CheckFileResult` to determine if a module should be
     * updated, added or removed, or if the result can be ignored.
     * @param result Description of what OMT properties could be found in a file at a specied path.
     */
    checkForChanges(result: CheckFileResult) {
        if (result.module?.name) {
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

    /**
     * Add or update a module. If there was another module with the same name it will be overwritten.
     * @param moduleResult All the useful information about an OMT module.
     */
    private processModule(moduleResult: OMTModule) {
        const { name, uri } = moduleResult;
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

    /**
     * Find the absolute path to the module.
     * @returns the absolute path, or undefined when the module could not be found.
     * @param name name of the module
     */
    getModulePath(name: string): string | undefined {
        const module = this.modules.get(name);
        return module?.uri;
    }

    /**
     * Remove the folder and all it's modules.
     * @param uri path of the folder
     */
    removeFolder(uri: string) {
        this.modules.forEach(module => {
            if (module.uri.startsWith(uri)) {
                this.modules.delete(module.name);
            }
        });
    }

    /**
     * Check if the file contained a module and remove it from the know modules
     * @param uri absolute path of the file
     */
    removeFile(uri: string) {
        this.modules.forEach(module => {
            if (module.uri == uri) {
                this.modules.delete(module.name);
            }
        });
    }
}

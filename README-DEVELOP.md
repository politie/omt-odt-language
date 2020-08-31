# Welcome to the `omt-odt-language` VS Code Extension

## What's in the repository

### The root of the repository

- `.*` - configuration files
- `CHANGELOG` - where we keep a comprehensive list of all the changes to the extension
- `LICENSE` - for reference
- `logo.png` - a logo for the extension in the marketplace
- `package.json` - the manifest file declaring all capabilities of the extension
- `README.md` - for users
- `tsconfig.json` - configuration for typescript compilation for the client and server code
- this file for the extension's developers

### The `client` folder

This folder contains the extension code that will be run on the client. it will start and connect to the server defined in `/server`. The client features can be tested by running `npm run test` from the workspace root. Features provided by the client:

- Document link for OMT imports with:
    - Relative paths
    - Paths beginning with a @Shorthand

### The `configurations` folder

This folder contains all language configurations.
These files end in `.language-configuration.json` and control declarative language features:

- Comment toggling
- Brackets definition
- Autoclosing
- Autosurrounding
- Folding
- Word pattern
- Indentation Rules

For more information on language configuration,
have a look at the [Language Configuration Guide](https://code.visualstudio.com/api/language-extensions/language-configuration-guide).

## The `server` folder

This folder contains all the code run as a node server. Ir provides the language-server functionality to the client plugin and is started by the extension in `/client`. It currently provides no additional functionality.

### The `snippets` folder

This folder contains all code snippets.
These files end in `*.snippets.json` and define snippets that can be inserted and filled out for the developer's convenience.

For more information on snippets, see the [Snippet Guide](https://code.visualstudio.com/api/language-extensions/snippet-guide).

### The `syntaxes` folder

This folder contains all TextMate grammar files for syntax highlighting.
These files end in `*.tmLanguage.json` and define the tokens which make up the language and the scopes they are assigned.

For more information on grammar files,
see the [Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
and [TextMate Language Grammars](https://macromates.com/manual/en/language_grammars).

## Testing the plugin

- Press `F5` to open an _Extension Development Host_, a VSCode window with the extension loaded.
- Create a new file with file name suffix `.omt` or `.odt`.
- Verify that syntax highlighting works and that the language configuration settings are working.

## Make changes

- You can relaunch the extension from the debug toolbar after making changes to the files listed above.
- You can also reload the VS Code window with your extension to load your changes with `Ctrl+R` (windows) or `⌘ R` (macOS).

## Add more language features

More about language extensions in the [Language Extensions Overview](https://code.visualstudio.com/api/language-extensions/overview).

## Using the extension

- To start using the extension with VSCode, copy it into the `~/.vscode/extensions` folder and restart VSCode.
- Read the [Extension API](https://code.visualstudio.com/api) for more information about publishing an extension.

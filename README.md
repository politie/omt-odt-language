# OMT & ODT Language Support README

![CI](https://github.com/emielb/omt-odt-language/workflows/Build%20and%20Test/badge.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/politie/omt-odt-language/badge.svg)](https://snyk.io/test/github/politie/omt-odt-language)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/pvr.omt-odt-language?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=pvr.omt-odt-language)
[![GitHub](https://img.shields.io/github/license/politie/omt-odt-language?color=blue)](https://github.com/politie/omt-odt-language/blob/main/LICENSE)

> Developers, developers, developers!
> *Steve Ballmer*

Like any serious programming language OMT and ODT deserve their own syntax
highlighting. We gathered the best people in the fields of semantics,
regular expressions and syntax highlighting coloring psychology. They then
worked 24/7 for two years to develop this extremely exciting extension.

![now in color](https://media.giphy.com/media/Eym0WtMIAzAu4/giphy.gif "Now in Color!")

## Features

The plugin includes two languages for syntax highlighting, OMT and ODT.
It will add document links to OMT imports and it also includes
several nifty snippets for both languages.

### Roadmap

In the future, more advanced features like syntax checking,
hover information, and code completion will be added.

## Extension Settings

The plugin should automatically recognise OMT and ODT files,
no configuration needed.
**If it doesn't**, add the folowing settings to your Preferences:

```json
    "files.associations": {
        "*.omt": "omt",
        "*.odt": "odt"
    },
```

To easily restart VSCode use `Ctrl + Shift + P`/`⇧ ⌘ P` and then type `Reload Window`.

After you restart VSCode OMT files should have a little OMT label
in the bottom right of your screen, and likewise for ODT.

## Issues

If you notice any problems or have suggestions for improved highlighting
you can add an issue on GitHub. You are also welcome to make a pull request
of your own for the desired changes.

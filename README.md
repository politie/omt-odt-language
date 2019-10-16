# OMT & ODT Language Support README

> Developers, developers, developers!
> *Steve Ballmer*

Like any serious programming language OMT and ODT deserve their own syntax highlighting.
We gathered the best people in the fields of semantics, regular expressions and syntax highlighting coloring psychology.
They then worked around the clock for two years to develop this extremely exciting extension.

![now in color](https://media.giphy.com/media/Eym0WtMIAzAu4/giphy.gif "Now in Color!")

## Features

The plugin includes two languages for syntax highlighting, OMT and ODT. It also includes several nifty snippets.

### Roadmap

In the future, more advanced features like syntax checking, hover information, and code completion will be added.

## Extension Settings

The plugin should automatically recognise OMT and ODT files, no configuration needed.
**If it doesn't**, add the folowing settings to your Preferences:

```json
    "files.associations": {
        "*.omt": "omt",
        "*.odt": "odt"
    },
```

To easily restart VSCode use `Ctrl + Shift + P`/`⇧ ⌘ P` and then type `Reload Window`.

After you restart VSCode OMT files should have a little OMT label in the bottom right of your screen, and likewise for ODT.

## Issues

If you notice any problems or have suggestions for improved highlighting you can add an issue on GitHub.
You are also welcome to make a pull request of your own for the desired changes.

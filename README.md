# OMT & ODT Language Support README

> Developers, developers, developers!
> *Steve Ballmer*

Like any serious programming language OMT deserves its own syntax highlighting. We gathered the best people in the fields of semantics, regular expressions and syntax highlighting coloring psychology. They then worked around the clock for two years to develop this extremely exciting extension.

![now in color](https://media.giphy.com/media/Eym0WtMIAzAu4/giphy.gif "Now in Color!")

## Features

The highlighter is based on the YAML syntax highlighting textmate bundle. From this we removed some of the unnessary parts and added the OMT specific items. At the moment most of the language features get some sort of color.

Also take a look at all the snippets that are available, they cover most of OMT & ODT.

## Extension Settings

Add the folowing setting to your Preferences:

```    
    "files.associations": {
        "*.omt": "omt"
    },
```

To easily restart VSCode use `Ctrl + Shift + P` and then type `Reload Window`.

After you restart VSCode OMT files should have a little OMT label in the bottom right of your screen.

## Issues

If you notice any problems or have suggestions for improved highlighting you can add an issue on Github.

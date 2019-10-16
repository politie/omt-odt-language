<!-- markdownlint-disable no-duplicate-header -->
# Change Log

All notable changes to the "omt-odt-language" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unpublished]

- ODT snippets
- OMT snippets
- Updated `README.md` and `README-DEVELOP.md`

## [2.0.0]

### Added

- ODT syntax highlighting
- Embedded ODT syntax highlighting in OMT syntax highlighting
- Plugin logo
- `LICENSE` file
- `README-DEVELOP.md`

### Changed

- Removed ODT syntax from OMT highlighting
- Revised OMT syntax highlighting
- Renamed plugin from "omt-vscode" to "omt-odt-language"
- Updated `README.md`

### Removed

- Snippets (*to be reimplemented later*)
- OMT sub theme
- clickable links to file imports in OMT (*to be reimplemented later*)

## [1.1.2]

### Added

- Added onRun snippet.
- Made `!dialog` a keyword.

## [1.1.1]

### Added

- Support CHOOSE WHEN odt statement.

## [1.1.0]

### Added

- It is now possible to ctrl + click on omt files in the import section.

## [1.0.4]

### Added

- Support is added for some of the newer commands like `TRIM`, `FIND_SUBJECTS`, `HAS` and `BLANK_NODE`
- `watchers`, `query`, `base` and other less used keywords are added to the keyword list.
  List is now sorted alphabetically for easier maintenance.

## [1.0.3]

### Added

- Folding rules and indentation rules added to language config.

### Fixed

- Changed the order of the ODT commands so that they are displayed the right way.
  This occurred because shorter commands where picked up sooner than the long ones.
  So only `MIN` was highlighted even though `MINUS` was used.

## [1.0.2]

### Added

- `onInit` is added as a keyword

### Fixed

- Spaces are better then tabs for the snippets

## [1.0.1]

### Fixed

- Fixed a bug where some comments don't get highlighting (#1)
- Fixed a bug where keywords are to broadly applied. (#1)
- Bug fixed where the prefixes highlighting is to broad (#2)

## [1.0.0]

### Added

- All ODT commands are now available as snippets.
- All OMT structures are now available as snippets.
- Syntax highlighting is available for most of the OMT code.

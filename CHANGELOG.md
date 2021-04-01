<!-- markdownlint-configure-file { "no-duplicate-header": { "siblings_only": true } } -->
# Changelog

This is a record of all notable changes to the "omt-odt-language" extension.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations
on how to structure this file.
This plugin uses [Semantic versioning](https://semver.org).

## [2.6.2] - 2021-04-01

## Added

- webpack bundling of the plugin to reduce its size (from ~26 MB to ~300 KB)

## [2.6.1] - Unreleased

### Changed

- updated dependencies

## [2.6.0] - Unreleased

### Added

- OMT highlighting support for `!MergePredicate` with `from: both`
- OMT snippet for `!MergePredicates` type handler

## [2.5.0] - 2021-03-08

### Added

- OMT highlighting support for:
  - `handlers` section of an `Activity` or `Procedure`
  - `!MergePredicates` definition for the `handlers` section

### Changed

- link semver in changelog and include release dates
- ODT highlighting support for:
  - interpolated strings
    variables and interpolation braces are now also highlighted

## [2.4.0] - 2021-02-01

### Added

- OMT highlighting support for:
  - `readonly` property for `variable` declarations
  - `!Ref` support for action and parameter references
  - `entitybar` support in global actions

## [2.3.0] - 2020-12-02

### Added

- OMT Declared import support
- unittesting and nyc coverage for `server`
- typescript and markdown linting.
  use `npm run linting` from the workspace root to check the entire project

### Changed

- Moved the parsing of OMT files for document links to the server

## [2.2.3] - 2020-10-28

### Added

- OMT highlighting support for:
  - the `reason` property for a `Procedure`

## [2.2.2] - 2020-10-27

### Added

- OMT highlighting support for:
  - the `reason` property for an `Activity`

## [2.2.1] - 2020-10-15

### Added

- OMT highlighting support for:
  - up to two flags on a `Command`
  - empty lists in the `imports` section and empty dictionaries in the `declare` section
  - the `busyDisabled` property for `Action`s
  - the `fixed` and `bestandstatus` global action registries

### Changed

- OMT highlighting for fully specified bindings and
  binding shortcuts is now the same

## [2.2.0] - 2020-09-08

### Added

- Document link support for OMT imports with filepaths
- Startup configuration for the language server for OMT and ODT

## [2.1.2] - 2020-03-23

### Added

- OMT highlighting for newly added global action type "bottomNavigation"

## [2.1.1] - 2020-01-16

### Changed

- OMT snippet and highlighting for menu with icon and
  newly added promoteSubMenuItemToMainMenu

## [2.1.0] - 2019-10-24

### Added

- ODT snippets
- OMT snippets

### Changed

- Updated `README.md` and `README-DEVELOP.md`

## [2.0.0] - 2019-10-01

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

- Support is added for some of the newer commands like
  `TRIM`, `FIND_SUBJECTS`, `HAS` and `BLANK_NODE`
- `watchers`, `query`, `base` and other less used keywords are added
  to the keyword list. List is now sorted alphabetically for easier maintenance.

## [1.0.3]

### Added

- Folding rules and indentation rules added to language config.

### Fixed

- Changed the order of the ODT commands so that they are displayed correctly.
  This occurred because shorter commands where picked up sooner than long ones.
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

# Change Log

All notable changes to the "ProbeJS" extension will be documented in this file.

## [v0.4.0]

- Updated for KubeJS version `2101.7.0-build.163`+

## [v0.3.1]

- Now automatically reconfigures tsserver plugin to prevent losing `Java.loadClass` between script types.

## [v0.3.0]

- **Only works with latest 1.21 ProbeJS due to KubeJS and `require` changes**
- Improved hint when connecting to the web server started by MC 1.21.
- Now shows item/block/tag icons for corresponding strings if connected to the web server.
- Script reload is currently not working for server scripts due to some KubeJS problem.
- Automatically imports `Java.loadClass` instead of `require` to comply with KubeJS.

## [v0.2.0]

- **Does not work with pre-1.21 ProbeJS due to completely rewritten.**
- Can highlight script properties like `// priority:` now.
- Can insert item/blockstate strings by activating `Kubedex` from a connected Minecraft instance.
- Can reload scripts from VSCode directly.
- Can catch error, warning and info from connected Minecraft instance and display them at corresponding line of the scripts.
- For scripts in `test/` folder, or has `test` in their path (including file name), you can `Evaluate` functions without params, or variables, at anytime.

## [v0.1.0]

- Added command `ProbeJS: Create Console` to create a runtime console for KubeJS. (requires ProbeJS v6.0.0+)
- Reconfigured `.vscodeignore` to ignore some unnecessary files.

## [v0.0.9]

- Extension now watches for changes in `.vscode` folder and reloads the attribute files automatically.

## [v0.0.8]

- Added command `ProbeJS: Populate Unlocalized Strings` to insert unlocalized strings (en_us) into current opened file.

## [v0.0.7]

- Added support for KubeJS 1.20.1.
- Changed how rich hover reads the image to make it work for both 1.20.1 and 1.19.2.
- Added support for automatic display of documentation for KubeJS events.

## [v0.0.6]

- Added support for fluid rendering.
- Added support for translations.
- Added support for color picking.

## [v0.0.5]

- Added correct parsing for `'` and `\``.
- Added support for item tags, indicated by `#${item_tag}`.

## [v0.0.4]

- Hover now correctly displays if the string is a `${number}x ${item}`

## [v0.0.3]

- Removed not so useful rich completions.
- Added useful rich hover display for KubeJS and configs.

## [v0.0.2]

- Suggestions will only appear when the first character of translated name is committed. (Case-sensitive)

## [v0.0.1]

- Initial release

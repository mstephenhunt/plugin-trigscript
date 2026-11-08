# TrigScript for VS Code

A small extension that starts `scmjs lsp`, TrigScript's language server, for the
TypeScript files of a map's script. The errors are the ones `scmjs map build` would
stop on, the completions after `locations.` are the map's own locations, and go to
definition opens the standard library's and a library's modules.

It is not on the Marketplace. To install it:

```sh
npm install -g @scm-js/cli typescript
cd editors/vscode
npm install
npx @vscode/vsce package          # writes scmjs-trigscript-0.1.0.vsix
code --install-extension scmjs-trigscript-0.1.0.vsix
```

Then open a folder of maps unpacked with `scmjs map unpack`: a `.ts` file under a map's
`trigscript/` folder is checked against that map. Other TypeScript files are left to VS
Code.

VS Code's own TypeScript checks the same files and does not know TrigScript's names, so
it marks `program`, `units` and the rest as unknown. Turn it off for the maps folder in
its `.vscode/settings.json`:

```json
{ "typescript.validate.enable": false }
```

Settings: `trigscript.server.command` (default `scmjs`) and `trigscript.server.args`
(default `["lsp"]`; add `"--map", "path/to/map.scx"` for a script that is not in an
unpacked map). The command line guide, docs.scmjs.dev/cli, has the setup for other
editors.

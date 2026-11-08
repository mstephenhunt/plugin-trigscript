// TrigScript in VS Code: starts `scmjs lsp` for the TypeScript files under a `trigscript/` folder (an unpacked map's
// script, `scmjs map unpack`) and leaves every other file to VS Code's own TypeScript. The language is the server's;
// this only starts it. See README.md.
const vscode = require("vscode");
const { LanguageClient, TransportKind } = require("vscode-languageclient/node");

let client;

async function activate(context) {
  const config = vscode.workspace.getConfiguration("trigscript.server");
  const command = config.get("command", "scmjs");
  const args = config.get("args", ["lsp"]);
  client = new LanguageClient("trigscript", "TrigScript", {
    run: { command, args, transport: TransportKind.stdio, options: { shell: process.platform === "win32" } },
    debug: { command, args, transport: TransportKind.stdio, options: { shell: process.platform === "win32" } },
  }, {
    documentSelector: [
      { scheme: "file", language: "typescript", pattern: "**/trigscript/**" },
      { scheme: "file", language: "typescriptreact", pattern: "**/trigscript/**" },
    ],
  });
  context.subscriptions.push(client);
  await client.start();
}

function deactivate() {
  return client?.stop();
}

module.exports = { activate, deactivate };

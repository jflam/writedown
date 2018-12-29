import * as vscode from 'vscode';
const { exec } = require('child_process');
var path = require('path');

import Window = vscode.window;

// We use the activate() function to register the commands for the writedown extension
export function activate(context: vscode.ExtensionContext) {

    // This is the array that we use to contain all of the disposable resources that we 
    // are registering with VS Code.
    var disposables = [];

    // Each command that we register must be registered with our disposables collection to 
    // ensure that we have the correct cleanup semantics when we are done.
    disposables.push(vscode.commands.registerCommand('writedown.paste', () => {

        // Before the paste command can run, we must have both an active editor and an active 
        // document (and should we test to see if the document is editable?)
        const editor = Window.activeTextEditor;
        const document = editor ? editor.document : null;
        if (!editor || !document) {
            return;
        }

        var currentlyOpenTabfilePath = document.fileName;
        var currentDirectory = path.dirname(currentlyOpenTabfilePath);
        console.log(`the path is: ${currentDirectory}`);

        // TODO: generate filename based on current directory and look for non-conflicting names
        // TODO: pass the name to the command string that we generate that will include the fully
        // qualified path to the thing

        const cmd = 'clippy --filename=c:/users/jlam/src/test/boo --max_width=800 --encoder=png --write_full=false';
        exec(cmd, (err: string, stdout: string, stderr: string) => {
            if (err) {
                console.log(`uh oh: ${err}.`);
                return;
            } else {
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);

                const start = editor.selection.start;

                // Run the base clipboard paste command. I believe that this command simply delegates to the
                // Electron paste command. When the paste command returns, the VS code selection in the editor
                // has been extended to encompass all of the text that was pasted into the editor.
                vscode.commands.executeCommand("editor.action.clipboardPasteAction")
                    .then(() => {

                        // Read the text from the document *after* it has been pasted. We don't have the ability
                        // to read the text beforehand, so we must first paste, then read the pasted text before
                        // we can reformat it into something else.
                        const end = editor.selection.end;
                        let selection = new vscode.Selection(start.line, start.character, end.line, end.character);
                        let selectedText = document.getText(selection);

                        // TODO: write a new class that handles examining the inserted text from the clipboard 
                        // and replacing it with the right thing. 

                        // TODO: if we want to examine the clipboard before the paste operation, e.g., detect 
                        // the presence of a bitmap image on the clipboard, we will need to use some cross platform
                        // node.js extensions to read from the clipboard.

                        // TODO: understand how to incorporate 3rd party node.js extensions into our VS Code 
                        // extension

                        // Do something silly: replace the selection with "holy moly"
                        editor.edit(edit => {
                            edit.replace(selection, '![holy moly](c:/users/jlam/src/test/boo.png)');
                        },
                            {
                                undoStopAfter: false,
                                undoStopBefore: false
                            });
                    });
            }
        });
    }));

    context.subscriptions.concat(disposables);
}

// this method is called when your extension is deactivated
export function deactivate() {}

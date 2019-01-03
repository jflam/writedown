import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import Window = vscode.window;

// TODO: typescript this?
const { exec } = require('child_process');

function generateUniqueFilename(directoryName: string, filename: string, extension: string): string {
    let counter = 0;
    let path1: string, path2: string;
    while(true) {
        path1 = `${directoryName}/${filename}-${counter}.${extension}`;
        path2 = `${directoryName}/${filename}-${counter}_full.${extension}`;
        if (!fs.existsSync(path1) && !fs.existsSync(path2)) {
            break;
        }
        counter++;
    }
    return `${filename}-${counter}`;
}

// We use the activate() function to register the commands for the writedown extension
export function activate(context: vscode.ExtensionContext) {

    // This is the array that we use to contain all of the disposable resources that we 
    // are registering with VS Code.
    var disposables = [];

    // Each command that we register must be registered with our disposables collection to 
    // ensure that we have the correct cleanup semantics when we are done.
    disposables.push(vscode.commands.registerCommand('writedown.pasteImage', () => {

        // Currently only supports Windows until we write a cross-platform clippy
        if (process.platform !== "win32")
        {
            // TODO: is there another way to disable even registering the command?
            vscode.window.showErrorMessage("The Paste Image command only works on Windows");
            return;
        }

        // Before the paste command can run, we must have both an active editor and an active 
        // document (and should we test to see if the document is editable?)
        const editor = Window.activeTextEditor;
        const document = editor ? editor.document : null;
        if (!editor || !document) {
            return;
        }

        // TODO: pull these parameters from configuration
        let image_filename = 'image';
        let image_max_width = 800;
        let image_encoder = 'jpg';
        let image_write_full = true;
        let media_directory = 'img';

        // Now extract the working directory for the markdown document from its filename
        let currentlyOpenTabfilePath = document.fileName;
        let currentDirectory = path.join(path.dirname(currentlyOpenTabfilePath), "..\\..\\static\\", media_directory);

        // Generate a unique filename for the image
        let filename = generateUniqueFilename(currentDirectory, image_filename, image_encoder);

        // Pop an input box in VS Code to allow the user to edit the filename
        let options: vscode.InputBoxOptions = {
            prompt: "Filename to save the image as (without extension)",
            value: `${currentDirectory}\\${filename}`,
            placeHolder: "",
            valueSelection: [currentDirectory.length + 1, currentDirectory.length + filename.length + 1]
        };

        vscode.window.showInputBox(options).then(accepted_filename => {
            if (accepted_filename !== undefined) {
                let cmd = `clippy --filename=${accepted_filename} --max_width=${image_max_width} --encoder=${image_encoder} --write_full=${image_write_full}`;
                exec(cmd, (err: string, stdout: string, stderr: string) => {
                    if (err) {
                        vscode.window.showErrorMessage(`clippy failed with this error: ${err}`);
                        return;
                    } else {
                        // Clippy successfully wrote the file out to disk, now generate the markdown
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

                                editor.edit(edit => {
                                    let local_filename = path.basename(accepted_filename)
                                    edit.replace(selection, `{{< figure src="/${media_directory}/${local_filename}.${image_encoder}" >}}`);
                                },
                                    {
                                        undoStopAfter: false,
                                        undoStopBefore: false
                                    });
                            });
                    }
                });
            }
        });
    }));

    context.subscriptions.concat(disposables);
}

// this method is called when your extension is deactivated
export function deactivate() {}

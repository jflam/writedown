import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import Window = vscode.window;
import * as ard from 'app-root-dir';

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

export function add(x: number, y: number): number {
    return x + y;
}

function getReplacementText(selectionText: string): [string, string] {

    // Define an array of regular expressions that we will iterate over
    let re_twitter: RegExp = /https:\/\/twitter.com\/.*?\/(\d+)/; 
    let re_youtube: RegExp = /https:\/\/www.youtube.com\/watch\?v\=(\w+)/;
    let re_vimeo: RegExp = /https:\/\/vimeo.com\/(\d+)/;
    let re_instagram: RegExp = /https:\/\/www.instagram.com\/.*?\/(.*?)\//;
    
    let regular_expressions: Array<[RegExp, string]> = [
        [re_twitter, "tweet"], 
        [re_youtube, "youtube"],
        [re_vimeo, "vimeo"],
        [re_instagram, "instagram"],
    ];

    for (let [re, shortcode] of regular_expressions) 
    {
        let match = re.exec(selectionText);
        if (match === null)
        {
            continue;
        }
        else
        {
            return [match[1], shortcode];
        }
    }

    return ["", ""];
}

// We use the activate() function to register the commands for the writedown extension
export function activate(context: vscode.ExtensionContext) {

    // This is the array that we use to contain all of the disposable resources that we 
    // are registering with VS Code.
    var disposables = [];

    // Each command that we register must be registered with our disposables collection to 
    // ensure that we have the correct cleanup semantics when we are done.
    disposables.push(vscode.commands.registerCommand('writedown.paste', () => {

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

        // Retrieve the path to the root of this extension (the root of the github repo)
        // and append /resources/bin to that path to find the clippy binary
        let path_to_clippy = path.join(ard.get(), "resources/bin/clippy");

        // Test to see if there is a bitmap on the clipboard
        let cmd = `${path_to_clippy} --test_clipboard_has_bitmap=true`;
        exec(cmd, (err: string, stdout: string, stderr: string) => {
            // We always fail the command if there is an error
            if (err)
            {
                vscode.window.showErrorMessage(`clippy failed with this error: ${stdout}`);
                return;
            }
            if (stdout === "TRUE")
            {
                // We are doing the bitmap thing
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

                        // TODO: add the right build step to the extension to copy the platform specific binary resources/bin
                        // Examine the filename extension and use that to determine the encoder
                        let extension = path.extname(accepted_filename).toLowerCase();
                        if (extension === ".jpg" || extension === ".png")
                        {
                            let bare_dirname = path.dirname(accepted_filename);
                            let bare_filename = path.basename(accepted_filename, extension);
                            extension = extension.substr(1);
                            let path_to_clippy = path.join(ard.get(), "resources/bin/clippy");
                            let path_to_bare_filename = path.join(bare_dirname, bare_filename);
                            let cmd = `${path_to_clippy} --filename=${path_to_bare_filename} --max_width=${image_max_width} --encoder=${extension} --write_full=${image_write_full}`;
                            exec(cmd, (err: string, stdout: string, stderr: string) => {
                                if (err) {
                                    vscode.window.showErrorMessage(`clippy failed with this error: ${stdout}`);
                                    return;
                                } else {
                                    // Clippy successfully wrote the file out to disk, now generate the markdown
                                    const start = editor.selection.start;
                                    const end = editor.selection.end;
                                    let selection = new vscode.Selection(start.line, start.character, end.line, end.character);

                                    editor.edit(edit => {
                                        edit.replace(selection, `{{< figure src="/${media_directory}/${bare_filename}.${extension}" >}}`);
                                    },
                                        {
                                            undoStopAfter: false,
                                            undoStopBefore: false
                                        });
                                }
                            });
                        }
                        else
                        {
                            vscode.window.showErrorMessage("Only png or jpg encoders are supported");
                        }
                    }
                });
            }
            else 
            {
                const start = editor.selection.start;

                // We are doing the text on clipboard thing

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
                        let selection_text = editor.document.getText(selection);
                        let [id, shortcode] = getReplacementText(selection_text);

                        if (id !== "")
                        {
                            editor.edit(edit => {
                                edit.replace(selection, `{{< ${shortcode} ${id} >}}`);
                                },
                                {
                                    undoStopAfter: false,
                                    undoStopBefore: false
                                }
                            );
                        }
                    });
            }
        });
    }));

    context.subscriptions.concat(disposables);
}

// this method is called when your extension is deactivated
export function deactivate() {}

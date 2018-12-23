import * as vscode from 'vscode';
import Window = vscode.window;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    console.log('writedown extension activated');

    var disposables = [];
    disposables.push(vscode.commands.registerCommand('extension.helloWorld', () => {
        vscode.window.showInformationMessage('My First Extension: Hello John!');
    }));

    disposables.push(vscode.commands.registerCommand('writedown.paste', () => {
        const e = Window.activeTextEditor;
        const d = e ? e.document : null;
        if (!e || !d) {
            return;
        }

    }));

    context.subscriptions.concat(disposables);
}

// this method is called when your extension is deactivated
export function deactivate() {}

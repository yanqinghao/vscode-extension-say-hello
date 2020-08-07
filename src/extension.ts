// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as OSS from 'ali-oss';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "say-hello" is now active!');
	const client = new OSS({
		region: 'oss-cn-beijing',
		accessKeyId: '',
		accessKeySecret: '',
		bucket: 'suanpan',
		// stsToken: '<security-token>'
	});

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('say-hello.helloWorld', (uri: vscode.Uri) => {
		// The code you place here will be executed every time your command is executed
		// client.put('common/model/obj', uri.fsPath);
		// Display a message box to the user
		// 'Hello World from say-hello!' + uri.fsPath
		let envGet = vscode.window.activeTextEditor?.document.uri.path
		if (typeof (envGet) != "undefined") { 
			vscode.window.showInformationMessage(envGet);
		} else {
			vscode.window.showInformationMessage("undefined");
		}

	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }

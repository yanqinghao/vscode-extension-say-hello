// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as OSS from 'ali-oss';
import * as rp from "request-promise-native";
import * as CryptoJS from "crypto-js";
import * as path from 'path';
import * as fs from 'fs';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('sp-vscode-assistant.uploadFiles', (uri: vscode.Uri) => {
		// The code you place here will be executed every time your command is executed
		console.log('Congratulations, your extension "say-hello" is now active!');
		let spHost = (process.env.SP_HOST === undefined) ? '' : process.env.SP_HOST;
		let spTls = (process.env.SP_HOST_TLS === 'true') ? 'https' : 'http';
		let spAccessSecret = (process.env.SP_ACCESS_SECRET === undefined) ? '' : process.env.SP_ACCESS_SECRET;
		let spUserId = (process.env.SP_USER_ID === undefined) ? '' : process.env.SP_USER_ID;
		let spAppId = (process.env.SP_APP_ID === undefined) ? '' : process.env.SP_APP_ID;
		let spNodeId = (process.env.SP_NODE_ID === undefined) ? '' : process.env.SP_NODE_ID;
		let getToken = '/oss/token';
		let apiUrl = `${spTls}://${spHost}${getToken}`;
		let encrypted = CryptoJS.HmacSHA1(spUserId, spAccessSecret);
		let encryptedString = CryptoJS.enc.Base64.stringify(encrypted);
		let spHeaders = {
			"x-sp-user-id": spUserId,
			"x-sp-signature": encryptedString,
			"x-sp-sign-version": "v1"
		};
		let options = {
			uri: apiUrl,
			headers: spHeaders,
			json: true
		};
		let ossPath = `studio/${spUserId}/${spAppId}/${spNodeId}/code`;

		rp(options).then(function (body) {
			const client = new OSS({
				region: body.region,
				accessKeyId: body.Credentials.AccessKeyId,
				accessKeySecret: body.Credentials.AccessKeySecret,
				bucket: 'suanpan',
				stsToken: body.Credentials.SecurityToken
			});
			if (fs.lstatSync(uri.fsPath).isFile()) {
				var fileName = path.parse(uri.fsPath).base;
				if (vscode.workspace.workspaceFolders !== undefined) {
					fileName = uri.fsPath.split(vscode.workspace.workspaceFolders[0].uri.path)[1];
				}
				let ossKey = path.join(ossPath, fileName);
				client.put(ossKey, uri.fsPath);
			} else {
				walk(uri.fsPath, function (filePath: string, stats: fs.Stats) {
					var fileName = path.parse(filePath).base;
					if (vscode.workspace.workspaceFolders !== undefined) {
						fileName = filePath.split(vscode.workspace.workspaceFolders[0].uri.path)[1];
					}
					let ossKey = path.join(ossPath, fileName);
					client.put(ossKey, filePath);
				});
			}
			vscode.window.showInformationMessage("upload success");
		}).catch(function (e) {
			console.log(e);
			vscode.window.showInformationMessage("fail to upload");
		});

	});

	context.subscriptions.push(disposable);
}

function walk(dir: string, callback: Function) {
	fs.readdir(dir, function (err, files) {
		if (err) { throw err; };
		files.forEach(function (file) {
			var filepath = path.join(dir.toString(), file);
			fs.stat(filepath, function (err, stats) {
				if (stats.isDirectory()) {
					walk(filepath, callback);
				} else if (stats.isFile()) {
					callback(filepath, stats);
				}
			});
		});
	});
};

// this method is called when your extension is deactivated
export function deactivate() { }

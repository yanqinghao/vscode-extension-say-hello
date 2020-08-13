// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as OSS from "ali-oss";
import * as rp from "request-promise-native";
import * as CryptoJS from "crypto-js";
import * as path from "path";
import * as fs from "fs";
import * as Minio from "minio";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposablePut = vscode.commands.registerCommand(
    "sp-vscode-assistant.uploadFiles",
    (uri: vscode.Uri) => {
      // The code you place here will be executed every time your command is executed
      console.log('Congratulations, your extension "say-hello" is now active!');
      const spHost =
        process.env.SP_HOST === undefined ? "" : process.env.SP_HOST;
      const spTls = process.env.SP_HOST_TLS === "true" ? "https" : "http";
      const spAccessSecret =
        process.env.SP_ACCESS_SECRET === undefined
          ? ""
          : process.env.SP_ACCESS_SECRET;
      const spUserId =
        process.env.SP_USER_ID === undefined ? "" : process.env.SP_USER_ID;
      const spAppId =
        process.env.SP_APP_ID === undefined ? "" : process.env.SP_APP_ID;
      const spNodeId =
        process.env.SP_NODE_ID === undefined ? "" : process.env.SP_NODE_ID;
      const spNodeConfig =
        process.env.NODE_CONFIG === undefined
          ? { app: { storage: { type: "oss" } } }
          : JSON.parse(process.env.NODE_CONFIG);
      const getToken = "/oss/token";
      const apiUrl = `${spTls}://${spHost}${getToken}`;
      const encrypted = CryptoJS.HmacSHA1(spUserId, spAccessSecret);
      const encryptedString = CryptoJS.enc.Base64.stringify(encrypted);
      const spHeaders = {
        "x-sp-user-id": spUserId,
        "x-sp-signature": encryptedString,
        "x-sp-sign-version": "v1",
      };
      const options = {
        uri: apiUrl,
        headers: spHeaders,
        json: true,
      };
      const ossPath = `studio/${spUserId}/${spAppId}/${spNodeId}/code`;

      rp(options)
        .then(function (body) {
          let client: OSS | Minio.Client;
          if (spNodeConfig.app.storage.type === "oss") {
            client = new OSS({
              region: body.region,
              accessKeyId: body.Credentials.AccessKeyId,
              accessKeySecret: body.Credentials.AccessKeySecret,
              bucket: body.bucket,
              stsToken: body.Credentials.SecurityToken,
            });
          } else {
            const storageParams: {
              endPoint: string;
              port: number;
              useSSL: boolean;
            } = {
              endPoint: "minio-serivce.default",
              port: 9000,
              useSSL: false,
            };
            storageParams.endPoint = spNodeConfig.oss.internalEndpoint.startsWith(
              "https://"
            )
              ? spNodeConfig.oss.internalEndpoint
                  .split("https://")[1]
                  .split(":")[0]
              : spNodeConfig.oss.internalEndpoint
                  .split("http://")[1]
                  .split(":")[0];
            storageParams.port = +spNodeConfig.oss.internalEndpoint.split(
              ":"
            )[2];
            storageParams.useSSL = spNodeConfig.oss.internalEndpoint.startsWith(
              "https://"
            );
            client = new Minio.Client({
              endPoint: storageParams.endPoint,
              port: storageParams.port,
              useSSL: storageParams.useSSL,
              accessKey: body.Credentials.AccessKeyId,
              secretKey: body.Credentials.AccessKeySecret,
            });
          }
          if (fs.lstatSync(uri.fsPath).isFile()) {
            let fileName = path.parse(uri.fsPath).base;
            if (vscode.workspace.workspaceFolders !== undefined) {
              fileName = uri.fsPath.split(
                vscode.workspace.workspaceFolders[0].uri.path
              )[1];
            }
            const ossKey = path.join(ossPath, fileName);
            if (client instanceof OSS) {
              client.put(ossKey, uri.fsPath);
            } else {
              client.fPutObject(body.bucket, ossKey, uri.fsPath, {});
            }
          } else {
            walk(uri.fsPath, function (filePath: string, stats: fs.Stats) {
              let fileName = path.parse(filePath).base;
              if (vscode.workspace.workspaceFolders !== undefined) {
                fileName = filePath.split(
                  vscode.workspace.workspaceFolders[0].uri.path
                )[1];
              }
              const ossKey = path.join(ossPath, fileName);
              if (client instanceof OSS) {
                client.put(ossKey, uri.fsPath);
              } else {
                client.fPutObject(body.bucket, ossKey, uri.fsPath, {});
              }
            });
          }
          vscode.window.showInformationMessage("upload success");
        })
        .catch(function (e) {
          console.log(e);
          vscode.window.showInformationMessage("fail to upload");
        });
    }
  );

  let disposableRemove = vscode.commands.registerCommand(
    "sp-vscode-assistant.removeFiles",
    (uri: vscode.Uri) => {
      // The code you place here will be executed every time your command is executed
      console.log('Congratulations, your extension "say-hello" is now active!');
      const spHost =
        process.env.SP_HOST === undefined ? "" : process.env.SP_HOST;
      const spTls = process.env.SP_HOST_TLS === "true" ? "https" : "http";
      const spAccessSecret =
        process.env.SP_ACCESS_SECRET === undefined
          ? ""
          : process.env.SP_ACCESS_SECRET;
      const spUserId =
        process.env.SP_USER_ID === undefined ? "" : process.env.SP_USER_ID;
      const spAppId =
        process.env.SP_APP_ID === undefined ? "" : process.env.SP_APP_ID;
      const spNodeId =
        process.env.SP_NODE_ID === undefined ? "" : process.env.SP_NODE_ID;
      const spNodeConfig =
        process.env.NODE_CONFIG === undefined
          ? { app: { storage: { type: "oss" } } }
          : JSON.parse(process.env.NODE_CONFIG);
      const getToken = "/oss/token";
      const apiUrl = `${spTls}://${spHost}${getToken}`;
      const encrypted = CryptoJS.HmacSHA1(spUserId, spAccessSecret);
      const encryptedString = CryptoJS.enc.Base64.stringify(encrypted);
      const spHeaders = {
        "x-sp-user-id": spUserId,
        "x-sp-signature": encryptedString,
        "x-sp-sign-version": "v1",
      };
      const options = {
        uri: apiUrl,
        headers: spHeaders,
        json: true,
      };
      const ossPath = `studio/${spUserId}/${spAppId}/${spNodeId}/code`;

      rp(options)
        .then(function (body) {
          let client: OSS | Minio.Client;
          if (spNodeConfig.app.storage.type === "oss") {
            client = new OSS({
              region: body.region,
              accessKeyId: body.Credentials.AccessKeyId,
              accessKeySecret: body.Credentials.AccessKeySecret,
              bucket: body.bucket,
              stsToken: body.Credentials.SecurityToken,
            });
          } else {
            const storageParams: {
              endPoint: string;
              port: number;
              useSSL: boolean;
            } = {
              endPoint: "minio-serivce.default",
              port: 9000,
              useSSL: false,
            };
            storageParams.endPoint = spNodeConfig.oss.internalEndpoint.startsWith(
              "https://"
            )
              ? spNodeConfig.oss.internalEndpoint
                  .split("https://")[1]
                  .split(":")[0]
              : spNodeConfig.oss.internalEndpoint
                  .split("http://")[1]
                  .split(":")[0];
            storageParams.port = +spNodeConfig.oss.internalEndpoint.split(
              ":"
            )[2];
            storageParams.useSSL = spNodeConfig.oss.internalEndpoint.startsWith(
              "https://"
            );
            client = new Minio.Client({
              endPoint: storageParams.endPoint,
              port: storageParams.port,
              useSSL: storageParams.useSSL,
              accessKey: body.Credentials.AccessKeyId,
              secretKey: body.Credentials.AccessKeySecret,
            });
          }
          if (fs.lstatSync(uri.fsPath).isFile()) {
            let fileName = path.parse(uri.fsPath).base;
            if (vscode.workspace.workspaceFolders !== undefined) {
              fileName = uri.fsPath.split(
                vscode.workspace.workspaceFolders[0].uri.path
              )[1];
            }
            const ossKey = path.join(ossPath, fileName);
            if (client instanceof OSS) {
              client.delete(ossKey);
            } else {
              client.removeObject(body.bucket, ossKey);
            }
          } else {
            walk(uri.fsPath, function (filePath: string, stats: fs.Stats) {
              let fileName = path.parse(filePath).base;
              if (vscode.workspace.workspaceFolders !== undefined) {
                fileName = filePath.split(
                  vscode.workspace.workspaceFolders[0].uri.path
                )[1];
              }
              const ossKey = path.join(ossPath, fileName);
              if (client instanceof OSS) {
                client.delete(ossKey);
              } else {
                client.removeObject(body.bucket, ossKey);
              }
            });
          }
          vscode.window.showInformationMessage("remove success");
        })
        .catch(function (e) {
          console.log(e);
          vscode.window.showInformationMessage("fail to remove");
        });
    }
  );

  context.subscriptions.push(disposablePut);
  context.subscriptions.push(disposableRemove);
}

function walk(dir: string, callback: Function) {
  fs.readdir(dir, function (err, files) {
    if (err) {
      throw err;
    }
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
}

// this method is called when your extension is deactivated
export function deactivate() {}

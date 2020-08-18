// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as OSS from "ali-oss";
import * as rp from "request-promise-native";
import * as CryptoJS from "crypto-js";
import * as path from "path";
import * as fs from "fs";
import * as Minio from "minio";

interface Headers {
  "x-sp-user-id": string;
  "x-sp-signature": string;
  "x-sp-sign-version": string;
}
interface Options {
  uri: string;
  headers: Headers;
  json: boolean;
}

interface RequestBody {
  region: string;
  Credentials: {
    AccessKeyId: string;
    AccessKeySecret: string;
    SecurityToken: string;
  };
  bucket: string;
  userId: string;
  type: string;
  success: boolean;
}

class StorageClient {
  // client: OSS | Minio.Client;
  type: string;
  options: Options;
  internalEndpoint: string;
  responceBody: rp.RequestPromise;
  ossPath: string;

  constructor(
    type: string,
    internalEndpoint: string,
    options: Options,
    ossPath: string
  ) {
    this.type = type;
    this.internalEndpoint = internalEndpoint;
    this.options = options;
    this.responceBody = this.getAccess();
    this.ossPath = ossPath;
  }

  async sync(filePath: string) {
    let client: OSS | Minio.Client;
    await this.responceBody.then(async (body) => {
      console.log(body);
      client = this.setClient(body);
      if (fs.lstatSync(filePath).isFile()) {
        await this.putFile(filePath, client, body.bucket, this.ossPath);
      } else {
        await this.syncFolder(filePath, client, body.bucket, this.ossPath);
      }
    });
  }

  async syncFolder(
    filePath: string,
    client: OSS | Minio.Client,
    bucket: string,
    ossPath: string
  ) {
    await this.putFolder(filePath, client, bucket, ossPath, true);
    await this.listObjects(filePath, client, bucket, ossPath);
  }

  async listObjects(
    filePath: string,
    client: OSS | Minio.Client,
    bucket: string,
    ossPath: string
  ) {
    let fileName = path.parse(filePath).base;
    if (vscode.workspace.workspaceFolders !== undefined) {
      fileName = filePath.split(
        vscode.workspace.workspaceFolders[0].uri.path
      )[1];
    }
    const ossKey = path.join(ossPath, fileName);
    if (client instanceof OSS) {
      let objs = (await client.list({ "max-keys": 1000, prefix: ossKey }, {}))
        .objects;
      for (let obj of objs) {
        console.log(obj);
        let fileName = path.join(filePath, obj.name.split(ossKey)[1]);
        if (vscode.workspace.workspaceFolders !== undefined) {
          fileName = path.join(
            vscode.workspace.workspaceFolders[0].uri.path,
            obj.name.split(ossKey)[1]
          );
        }
        if (!obj.name.endsWith("/")) {
          if (fs.existsSync(fileName)) {
            console.log(`file ${fileName} already exists.`);
          } else {
            let folderName = path.parse(fileName).dir;
            if (!fs.existsSync(folderName)) {
              fs.mkdirSync(folderName, { recursive: true });
            }
            client.get(obj.name, fileName);
          }
        }
      }
    } else {
      client.listObjectsV2(bucket, ossKey, true).on("data", (obj) => {
        console.log(obj);
        let fileName = path.join(filePath, obj.name.split(ossKey)[1]);
        if (vscode.workspace.workspaceFolders !== undefined) {
          fileName = path.join(
            vscode.workspace.workspaceFolders[0].uri.path,
            obj.name.split(ossKey)[1]
          );
        }
        if (fs.existsSync(fileName)) {
          console.log(`file ${fileName} already exists.`);
        } else {
          let folderName = path.parse(fileName).dir;
          if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName, { recursive: true });
          }
          client.fGetObject(bucket, obj.name, fileName);
        }
      });
    }
  }

  async getFile(
    filePath: string,
    client: OSS | Minio.Client,
    bucket: string,
    ossPath: string
  ) {
    let fileName = path.parse(filePath).base;
    if (vscode.workspace.workspaceFolders !== undefined) {
      fileName = filePath.split(
        vscode.workspace.workspaceFolders[0].uri.path
      )[1];
    }
    const ossKey = path.join(ossPath, fileName);
    let folderName = path.parse(filePath).dir;
    if (!fs.existsSync(folderName)) {
      fs.mkdirSync(folderName);
    }
    if (client instanceof OSS) {
      await client.get(ossKey, filePath);
    } else {
      await client.fGetObject(bucket, ossKey, filePath);
    }
  }

  async remove(filePath: string) {
    let client: OSS | Minio.Client;
    await this.responceBody.then(async (body) => {
      console.log(body);
      client = this.setClient(body);
      if (fs.lstatSync(filePath).isFile()) {
        await this.removeFile(filePath, client, body.bucket, this.ossPath);
      } else {
        await this.removeFolder(filePath, client, body.bucket, this.ossPath);
      }
    });
  }

  async put(filePath: string) {
    let client: OSS | Minio.Client;
    await this.responceBody.then(async (body) => {
      console.log(body);
      client = this.setClient(body);
      if (fs.lstatSync(filePath).isFile()) {
        await this.putFile(filePath, client, body.bucket, this.ossPath);
      } else {
        await this.putFolder(filePath, client, body.bucket, this.ossPath);
      }
    });
  }

  async removeFolder(
    filePath: string,
    client: OSS | Minio.Client,
    bucket: string,
    ossPath: string
  ) {
    let fileList: string[] = [];
    fileList = this.walk(filePath, fileList);
    for (let file of fileList) {
      await this.removeFile(file, client, bucket, ossPath);
    }
  }

  async removeFile(
    filePath: string,
    client: OSS | Minio.Client,
    bucket: string,
    ossPath: string
  ) {
    let fileName = path.parse(filePath).base;
    if (vscode.workspace.workspaceFolders !== undefined) {
      fileName = filePath.split(
        vscode.workspace.workspaceFolders[0].uri.path
      )[1];
    }
    const ossKey = path.join(ossPath, fileName);
    if (client instanceof OSS) {
      await client.delete(ossKey);
    } else {
      await client.removeObject(bucket, ossKey);
    }
  }

  async putFolder(
    filePath: string,
    client: OSS | Minio.Client,
    bucket: string,
    ossPath: string,
    checksize = false
  ) {
    let fileList: string[] = [];
    fileList = this.walk(filePath, fileList);
    for (let file of fileList) {
      await this.putFile(file, client, bucket, ossPath, checksize);
    }
  }

  async putFile(
    filePath: string,
    client: OSS | Minio.Client,
    bucket: string,
    ossPath: string,
    checksize = false
  ) {
    let fileName = path.parse(filePath).base;
    if (vscode.workspace.workspaceFolders !== undefined) {
      fileName = filePath.split(
        vscode.workspace.workspaceFolders[0].uri.path
      )[1];
    }
    const ossKey = path.join(ossPath, fileName);
    if (checksize) {
      if (fs.statSync(filePath).size < 204800) {
        if (client instanceof OSS) {
          await client.put(ossKey, filePath);
        } else {
          await client.fPutObject(bucket, ossKey, filePath, {});
        }
      }
    } else {
      if (client instanceof OSS) {
        await client.put(ossKey, filePath);
      } else {
        await client.fPutObject(bucket, ossKey, filePath, {});
      }
    }
  }

  walk(dir: string, fileList: string[]) {
    fs.readdirSync(dir).forEach((file) => {
      let filepath = path.join(dir.toString(), file);
      if (fs.statSync(filepath).isDirectory()) {
        fileList.concat(this.walk(filepath, fileList));
      } else {
        fileList.push(filepath);
      }
    });
    return fileList;
  }

  setClient(body: RequestBody) {
    if (this.type === "oss") {
      return new OSS({
        region: body.region,
        accessKeyId: body.Credentials.AccessKeyId,
        accessKeySecret: body.Credentials.AccessKeySecret,
        bucket: body.bucket,
        stsToken: body.Credentials.SecurityToken,
      });
    } else {
      const minioParams: {
        endPoint: string;
        port: number;
        useSSL: boolean;
      } = {
        endPoint: "minio-serivce.default",
        port: 9000,
        useSSL: false,
      };
      minioParams.endPoint = this.internalEndpoint.startsWith("https://")
        ? this.internalEndpoint.split("https://")[1].split(":")[0]
        : this.internalEndpoint.split("http://")[1].split(":")[0];
      minioParams.port = +this.internalEndpoint.split(":")[2];
      minioParams.useSSL = this.internalEndpoint.startsWith("https://");
      return new Minio.Client({
        endPoint: minioParams.endPoint,
        port: minioParams.port,
        useSSL: minioParams.useSSL,
        accessKey: body.Credentials.AccessKeyId,
        secretKey: body.Credentials.AccessKeySecret,
      });
    }
  }

  updateAccess() {
    this.responceBody = rp(this.options);
  }

  getAccess() {
    return rp(this.options);
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const spHost = process.env.SP_HOST === undefined ? "" : process.env.SP_HOST;
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
      ? {
          app: { storage: { type: "oss" } },
          oss: {
            internalEndpoint: "https://oss-cn-beijing-internal.aliyuncs.com",
          },
        }
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
  const storageClient = new StorageClient(
    spNodeConfig.app.storage.type,
    spNodeConfig.oss.internalEndpoint,
    options,
    ossPath
  );
  if (vscode.workspace.workspaceFolders !== undefined) {
    let filePath = vscode.workspace.workspaceFolders[0].uri.path;
    try {
      await storageClient.sync(filePath);
      console.log("success to init files");
    } catch (err) {
      if (err.status === 403 || err.code === "InvalidAccessKeyId") {
        try {
          storageClient.updateAccess();
          await storageClient.sync(filePath);
          console.log("success to init files");
        } catch (err) {
          console.log("fail to init files");
        }
      } else {
        console.log("fail to init files");
      }
    }
  }

  let disposablePut = vscode.commands.registerCommand(
    "sp-vscode-assistant.uploadFiles",
    async (uri: vscode.Uri) => {
      // The code you place here will be executed every time your command is executed
      console.log("upload files plugin activate!");
      try {
        await storageClient.put(uri.fsPath);
        vscode.window.showInformationMessage("success to upload");
      } catch (err) {
        if (err.status === 403 || err.code === "InvalidAccessKeyId") {
          try {
            storageClient.updateAccess();
            await storageClient.put(uri.fsPath);
            vscode.window.showInformationMessage("success to upload");
          } catch (err) {
            vscode.window.showInformationMessage("fail to upload");
          }
        } else {
          vscode.window.showInformationMessage("fail to upload");
        }
      }
    }
  );

  let disposableRemove = vscode.commands.registerCommand(
    "sp-vscode-assistant.removeFiles",
    async (uri: vscode.Uri) => {
      // The code you place here will be executed every time your command is executed
      console.log("remove files plugin activate!");

      try {
        await storageClient.remove(uri.fsPath);
        vscode.window.showInformationMessage("success to remove");
      } catch (err) {
        if (err.status === 403 || err.code === "InvalidAccessKeyId") {
          try {
            storageClient.updateAccess();
            await storageClient.remove(uri.fsPath);
            vscode.window.showInformationMessage("success to remove");
          } catch (err) {
            vscode.window.showInformationMessage("fail to remove");
          }
        } else {
          vscode.window.showInformationMessage("fail to remove");
        }
      }
    }
  );

  let disposableOnsave = vscode.workspace.onDidSaveTextDocument((e) => {
    // The code you place here will be executed every time your command is executed
    console.log("on save files plugin activate!");
    try {
      storageClient.put(e.uri.path);
      console.log("success to upload");
    } catch (err) {
      if (err.status === 403 || err.code === "InvalidAccessKeyId") {
        try {
          storageClient.updateAccess();
          storageClient.put(e.uri.path);
          console.log("success to upload");
        } catch (err) {
          console.log("fail to upload");
        }
      } else {
        console.log("fail to upload");
      }
    }
  });

  let disposableSync = vscode.commands.registerCommand(
    "sp-vscode-assistant.syncFiles",
    async (uri: vscode.Uri) => {
      // The code you place here will be executed every time your command is executed
      console.log("sync files plugin activate!");
      let filePath: string | undefined;

      if (typeof uri === "undefined") {
        if (typeof vscode.workspace.workspaceFolders === "undefined") {
          filePath = undefined;
        } else {
          filePath = vscode.workspace.workspaceFolders[0].uri.path;
        }
      } else {
        filePath = uri.path;
      }

      if (typeof filePath === "undefined") {
        vscode.window.showInformationMessage("can not find the path to sync!");
      } else {
        try {
          await storageClient.sync(filePath);
          vscode.window.showInformationMessage("success to sync files");
        } catch (err) {
          if (err.status === 403 || err.code === "InvalidAccessKeyId") {
            try {
              storageClient.updateAccess();
              await storageClient.sync(filePath);
              vscode.window.showInformationMessage("success to sync files");
            } catch (err) {
              vscode.window.showInformationMessage("fail to sync files");
            }
          } else {
            vscode.window.showInformationMessage("fail to sync files");
          }
        }
      }
    }
  );

  context.subscriptions.push(disposablePut);
  context.subscriptions.push(disposableRemove);
  context.subscriptions.push(disposableOnsave);
  context.subscriptions.push(disposableSync);
}

// this method is called when your extension is deactivated
export function deactivate() {}

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { decryptReadme } from "../crypto/normalCrypto";

const SCHEME = "protected-readme";

export function registerReadmeViewer(context: vscode.ExtensionContext) {
  const provider: vscode.TextDocumentContentProvider = {
    provideTextDocumentContent(uri) {
      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (!workspace) return "No workspace";

      const encPath = path.join(workspace.uri.fsPath, "src", "README.enc");
      if (!fs.existsSync(encPath)) return "README.enc not found";

      const enc = fs.readFileSync(encPath);
      return decryptReadme(enc);
    },
  };

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(SCHEME, provider)
  );
}

export async function openProtectedReadme() {
  const uri = vscode.Uri.parse(`${SCHEME}:README.md`);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, { preview: false });
}

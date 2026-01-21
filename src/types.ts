import * as vscode from 'vscode';

export interface ProjectGenerator extends vscode.QuickPickItem {
    readonly label: string;
    readonly description: string;
    createProject(context: vscode.ExtensionContext): Promise<void>;
}
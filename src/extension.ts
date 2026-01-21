import * as vscode from 'vscode';
import { allGenerators } from './generate/index';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import AdmZip = require('adm-zip');

export async function activate(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const rootPath = workspaceFolders[0].uri.fsPath;
        const markerPath = path.join(rootPath, '.vsc_success');

        if (fs.existsSync(markerPath)) {
            const projectName = fs.readFileSync(markerPath, 'utf8');
            vscode.window.showInformationMessage(`Project '${projectName}' generated successfully!`);
            fs.unlinkSync(markerPath);
        }
    }

    const storagePath = context.globalStorageUri.fsPath;
    const templateFolder = path.join(storagePath, 'project-template');

    const folderExists = fs.existsSync(templateFolder);
    if (!folderExists) {
        await context.globalState.update('templatesDownloaded', false); 
        await downloadTemplates(context);
    }

    const newProject = vscode.commands.registerCommand('project-generator.newProject', async () => {
        const selectedGenerator = await vscode.window.showQuickPick(allGenerators, {
            placeHolder: 'Select a programming language to start',
            ignoreFocusOut: true
        });

        if (selectedGenerator) {
            await selectedGenerator.createProject(context);
        }
    });

    const updateTemplates = vscode.commands.registerCommand('project-generator.updateTemplates', async () => {
        await downloadTemplates(context);
    });

    context.subscriptions.push(newProject, updateTemplates);
}

async function downloadTemplates(context: vscode.ExtensionContext) {
    const storageUri = context.globalStorageUri;
    const storagePath = storageUri.fsPath;
    const zipFilePath = path.join(storagePath, 'project-template.zip');
    
    const finalTemplateFolder = path.join(storagePath, 'project-template');
    const extractedFolderName = 'project-template-main'; 
    const extractedPath = path.join(storagePath, extractedFolderName);

    const repoUrl = "https://github.com/daivuducit/project-template/archive/refs/heads/main.zip";

    try {
        await vscode.workspace.fs.createDirectory(storageUri);

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Project Generator",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Downloading templates from GitHub..." });
            
            const response = await axios({
                method: 'get',
                url: repoUrl,
                responseType: 'arraybuffer'
            });

            fs.writeFileSync(zipFilePath, response.data);

            progress.report({ message: "Extracting files to local storage..." });
            const zip = new AdmZip(zipFilePath);
            
            zip.extractAllTo(storagePath, true);

            if (fs.existsSync(finalTemplateFolder)) {
                fs.rmSync(finalTemplateFolder, { recursive: true, force: true });
            }

            if (fs.existsSync(extractedPath)) {
                fs.renameSync(extractedPath, finalTemplateFolder);
            }

            if (fs.existsSync(zipFilePath)) {
                fs.unlinkSync(zipFilePath);
            }

            await context.globalState.update('templatesDownloaded', true);
            vscode.window.showInformationMessage("Templates storage updated successfully!");
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Update failed: ${error.message}`);
    }
}

export function deactivate() {}
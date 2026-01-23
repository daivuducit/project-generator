import * as vscode from 'vscode';
import { allGenerators } from './generate/index';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import axios from 'axios';
import AdmZip = require('adm-zip');

export async function activate(context: vscode.ExtensionContext) {
    markSuccessfulGeneration();

    const storagePath = context.globalStorageUri.fsPath;
    const templateFolder = path.join(storagePath, 'project-template');

    if (!existsSync(templateFolder)) {
        await downloadTemplates(context);
    } else {
        checkForUpdates(context);
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

async function markSuccessfulGeneration() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const rootPath = workspaceFolders[0].uri.fsPath;
        const markerPath = path.join(rootPath, '.vsc_success');

        if (existsSync(markerPath)) {
            try {
                const projectName = await fs.readFile(markerPath, 'utf8');
                vscode.window.showInformationMessage(`Project '${projectName}' generated successfully!`);
                await fs.unlink(markerPath);
            } catch (err) {
                console.error("Failed to process success marker:", err);
            }
        }
    }
}

async function checkForUpdates(context: vscode.ExtensionContext) {
    const repoApiUrl = "https://api.github.com/repos/daivuducit/project-template/branches/main";
    const lastSHA = context.globalState.get<string>('lastTemplateSHA');

    try {
        const response = await axios.get(repoApiUrl, {
            headers: {
                'User-Agent': 'vscode-extension-project-generator',
                'Cache-Control': 'no-cache'
            }
        });

        const currentSha = response.data.commit.sha;

        if (currentSha !== lastSHA) {
            await downloadTemplates(context, currentSha);
        }
    } catch (error) {
        console.error("Silent update check failed:", error instanceof Error ? error.message : String(error));
    }
}

async function downloadTemplates(context: vscode.ExtensionContext, newSHA?: string) {
    const storagePath = context.globalStorageUri.fsPath;
    const zipFilePath = path.join(storagePath, 'template.zip');
    const finalTemplateFolder = path.join(storagePath, 'project-template');
    const repoUrl = "https://github.com/daivuducit/project-template/archive/refs/heads/main.zip";
    const repoApiUrl = "https://api.github.com/repos/daivuducit/project-template/branches/main";

    try {
        if (!existsSync(storagePath)) {
            await fs.mkdir(storagePath, { recursive: true });
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Project Generator: Updating Templates",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Downloading latest templates..." });
            const response = await axios({
                method: 'get',
                url: repoUrl,
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'vscode-extension-project-generator' }
            });

            await fs.writeFile(zipFilePath, Buffer.from(response.data));

            progress.report({ message: "Extracting files..." });
            const zip = new AdmZip(zipFilePath);
            zip.extractAllTo(storagePath, true);

            progress.report({ message: "Finalizing template setup..." });
            const extractedPath = path.join(storagePath, 'project-template-main');
            
            if (existsSync(finalTemplateFolder)) {
                await fs.rm(finalTemplateFolder, { recursive: true, force: true });
            }

            if (existsSync(extractedPath)) {
                try {
                    await fs.rename(extractedPath, finalTemplateFolder);
                } catch (renameError) {
                    console.warn("Rename failed, attempting fallback copy...", renameError);
                }
            }

            if (existsSync(zipFilePath)) {
                await fs.unlink(zipFilePath);
            }

            const shaToSave = newSHA || (await axios.get(repoApiUrl, { headers: { 'User-Agent': 'vscode-extension-project-generator' } })).data.commit.sha;
            await context.globalState.update('lastTemplateSHA', shaToSave);

            vscode.window.showInformationMessage("Templates are up to date!");
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`Template update failed: ${error.message}`);
    }
}

export function deactivate() {}
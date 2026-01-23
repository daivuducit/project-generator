import * as vscode from 'vscode';
import { ProjectGenerator } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class JavaGenerator implements ProjectGenerator {
    public readonly label = 'Java';
    public readonly description = 'Generate a Java project';

    private showMessage(message: string, isError: boolean = false): void {
        if (isError) {
            vscode.window.showErrorMessage(message);
        } else {
            vscode.window.showInformationMessage(message);
        }
    }

    public async createProject(context: vscode.ExtensionContext): Promise<void> {
        const templatePath = path.join(context.globalStorageUri.fsPath, 'project-template/java');

        try {
            // Check if template directory exists
            if (!fs.existsSync(templatePath)) {
                this.showMessage('Java templates not found. Please update templates first.', true);
                return;
            }

            // Navigate through templates until we find one with cookiecutter.json
            let currentPath = templatePath;
            let finalTemplatePath = '';

            while (true) {
                const cookiecutterPath = path.join(currentPath, 'cookiecutter.json');
                
                if (fs.existsSync(cookiecutterPath)) {
                    finalTemplatePath = currentPath;
                    break;
                }

                // Get subdirectories
                const items = fs.readdirSync(currentPath, { withFileTypes: true });
                const directories = items
                    .filter(item => item.isDirectory())
                    .map(dir => ({
                        label: dir.name,
                        // description: `Template: ${dir.name}`,
                        dirPath: path.join(currentPath, dir.name)
                    }));

                if (directories.length === 0) {
                    this.showMessage('No valid Java templates found.', true);
                    return;
                }

                const selectedTemplate = await vscode.window.showQuickPick(directories, {
                    placeHolder: 'Select a Java template',
                    ignoreFocusOut: true
                });

                if (!selectedTemplate) {
                    return; // User cancelled
                }

                currentPath = selectedTemplate.dirPath;
            }

            // Parse cookiecutter.json to get required inputs
            const cookiecutterConfig = JSON.parse(fs.readFileSync(path.join(finalTemplatePath, 'cookiecutter.json'), 'utf8'));
            const inputs: { [key: string]: string } = {};

            // Collect user inputs based on cookiecutter.json
            for (const [key, defaultValue] of Object.entries(cookiecutterConfig)) {
                if (key === '_extensions' || key === '_templates' || key === '_copy_without_render') {
                    continue; // Skip cookiecutter internal keys
                }

                // Skip fields with template expressions (e.g., "{{ cookiecutter.project_name | lower() }}")
                if (typeof defaultValue === 'string' && defaultValue.startsWith('{{') && defaultValue.endsWith('}}')) {
                    continue;
                }

                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                let inputValue: string | undefined;

                if (Array.isArray(defaultValue)) {
                    // Multiple choice input
                    inputValue = await vscode.window.showQuickPick(defaultValue as string[], {
                        placeHolder: `Select ${displayKey}`,
                        ignoreFocusOut: true
                    });
                } else {
                    // Text input
                    inputValue = await vscode.window.showInputBox({
                        prompt: `Enter ${displayKey}`,
                        value: String(defaultValue),
                        ignoreFocusOut: true
                    });
                }

                if (inputValue === undefined) {
                    return; // User cancelled
                }

                inputs[key] = inputValue;
            }

            // Let user choose destination folder
            const targetFolder = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Folder to Save Project'
            });

            if (!targetFolder || targetFolder.length === 0) {
                return;
            }

            const outputDir = targetFolder[0].fsPath;
            const projectName = inputs.project_name || inputs.name || 'java-project';
            const projectSlug = projectName.toLowerCase().replace(/ /g, '-').replace(/_/g, '-');
            const projectPath = path.join(outputDir, projectSlug);

            // Generate the project using cookiecutter
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Java Project...",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Running template engine..." });
                
                // Build cookiecutter command with all inputs
                let command = `cookiecutter "${finalTemplatePath}" --no-input -o "${outputDir}"`;
                
                for (const [key, value] of Object.entries(inputs)) {
                    command += ` ${key}="${value}"`;
                }
                
                await execPromise(command);

                progress.report({ message: "Project generated successfully!" });
            });
            
            // Check if project was created successfully and open it
            if (fs.existsSync(projectPath)) {
                const markerFile = path.join(projectPath, '.vsc_success');
                fs.writeFileSync(markerFile, projectName);

                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath), false); 
            }

        } catch (error: any) {
            this.showMessage(`Java Project Generation Error: ${error.message}`, true);
        }
    }
}
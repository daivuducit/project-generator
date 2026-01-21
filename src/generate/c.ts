import * as vscode from 'vscode';
import { ProjectGenerator } from '../types';

export class CGenerator implements ProjectGenerator {
    public readonly label = 'C';
    public readonly description = 'Generate a C project';

    public async createProject(context: vscode.ExtensionContext): Promise<void> {
        
    }
}
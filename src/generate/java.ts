import * as vscode from 'vscode';
import { ProjectGenerator } from '../types';

export class JavaGenerator implements ProjectGenerator {
    public readonly label = 'Java';
    public readonly description = 'Generate a Java project';

    public async createProject(context: vscode.ExtensionContext): Promise<void> {
        
    }
}
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { ProjectGenerator } from "../types";
import { encryptReadmeIfExists } from "../postProcess/encryptReadme";

const execPromise = promisify(exec);

export class CGenerator implements ProjectGenerator {
  public readonly label = "C";
  public readonly description = "Generate a C project";

  private async execSafe(cmd: string): Promise<string | null> {
    try {
      const { stdout } = await execPromise(cmd);
      const out = stdout.trim();
      return out.length ? out : null;
    } catch {
      return null;
    }
  }

  private async detectAuthorAndGitHub(): Promise<{
    author: string;
    github: string;
  }> {
    const github = await this.execSafe("gh api user --jq .login");
    if (github) {
      return { author: github, github };
    }

    const gitName = await this.execSafe("git config --global user.name");
    if (gitName) {
      return { author: gitName, github: gitName };
    }

    const osUser =
      process.platform === "win32" ? process.env.USERNAME : process.env.USER;

    return {
      author: osUser || "windows",
      github: osUser || "windows",
    };
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  public async createProject(context: vscode.ExtensionContext): Promise<void> {
    try {
      const rawName = await vscode.window.showInputBox({
        prompt: "Enter C project name",
        value: "c-project",
      });
      if (!rawName) {
        return;
      }

      const projectSlug = this.slugify(rawName);
      if (!projectSlug) {
        vscode.window.showErrorMessage("Invalid project name.");
        return;
      }

      const { author, github } = await this.detectAuthorAndGitHub();

      const targetFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select folder to create project",
      });
      if (!targetFolder || targetFolder.length === 0) {
        return;
      }

      const outputDir = targetFolder[0].fsPath;
      const projectPath = path.join(outputDir, projectSlug);

      const templatePath = path.join(
        context.globalStorageUri.fsPath,
        "project-template",
        "C",
      );

      if (!fs.existsSync(templatePath)) {
        vscode.window.showErrorMessage("C template not found.");
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating C Project...",
          cancellable: false,
        },
        async () => {
          const command =
            `cookiecutter "${templatePath}" --no-input -o "${outputDir}" ` +
            `project_slug="${projectSlug}" ` +
            `author="${author}" ` +
            `github_username="${github}"`;

          await execPromise(command);

          
          console.log("[GEN] projectPath =", projectPath);

          await encryptReadmeIfExists(projectPath);

       

        },
      );

      if (fs.existsSync(projectPath)) {
        await vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(projectPath),
          false,
        );
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(
        `C project generation failed: ${err.message}`,
      );
    }
  }
}

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { ProjectGenerator } from "../types";

const execPromise = promisify(exec);

export class PythonGenerator implements ProjectGenerator {
  public readonly label = "Python";
  public readonly description = "Generate a Python project";

  private showMessage(message: string, isError: boolean = false): void {
    if (isError) {
      vscode.window.showErrorMessage(message);
    } else {
      vscode.window.showInformationMessage(message);
    }
  }

  public async createProject(context: vscode.ExtensionContext): Promise<void> {
    const templatePath = path.join(
      context.globalStorageUri.fsPath,
      "project-template/python",
    );

    try {
      const interpreters = await this.getAvailableInterpreters();

      if (interpreters.length === 0) {
        vscode.window.showErrorMessage(
          "Python Interpreter Not Found: Please ensure Python is installed.",
        );
        return;
      }

      let interpreterPath: string = "";
      let detectedVersion: string = "";
      let selectionFinished = false;

      while (!selectionFinished) {
        const selectedInterpreter = await vscode.window.showQuickPick(
          interpreters,
          {
            placeHolder:
              'Select the Python interpreter or "Other..." to browse',
            ignoreFocusOut: true,
          },
        );

        if (!selectedInterpreter) {
          return;
        }

        if (selectedInterpreter.label === "$(folder-opened) Other...") {
          const browseResult = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            openLabel: "Select Python Executable",
            filters:
              process.platform === "win32"
                ? { Executables: ["exe"] }
                : undefined,
          });

          if (!browseResult || browseResult.length === 0) {
            continue;
          }

          const manualPath = browseResult[0].fsPath;

          try {
            const { stdout: verOut } = await execPromise(
              `"${manualPath}" --version`,
            );
            detectedVersion = verOut.trim().replace("Python ", "");
            interpreterPath = manualPath;
            selectionFinished = true;
          } catch (e) {
            this.showMessage(
              "Invalid Python Executable: The selected file is not a valid Python interpreter.",
              true,
            );
          }
        } else {
          interpreterPath = selectedInterpreter.description!;
          detectedVersion = selectedInterpreter.label;
          selectionFinished = true;
        }
      }

      const projectName = await vscode.window.showInputBox({
        prompt: "Enter Project Name",
        value: "my-python-project",
      });
      if (projectName === undefined) {
        return;
      }

      const projectDescription = await vscode.window.showInputBox({
        prompt: "Enter Project Description",
        value: "A Python project description",
      });
      if (projectDescription === undefined) {
        return;
      }

      const fullName = await vscode.window.showInputBox({
        prompt: "Enter Author Full Name",
        value: "Author",
      });
      if (fullName === undefined) {
        return;
      }

      const email = await vscode.window.showInputBox({
        prompt: "Enter Author Email",
        value: "your.email@example.com",
      });
      if (email === undefined) {
        return;
      }

      const githubUsername = await vscode.window.showInputBox({
        prompt: "Enter GitHub Username",
        value: "your-github-handle",
      });
      if (githubUsername === undefined) {
        return;
      }

      const version = await vscode.window.showInputBox({
        prompt: "Enter Project Version",
        value: "0.1.0",
      });
      if (version === undefined) {
        return;
      }

      const license = await vscode.window.showQuickPick(
        ["MIT", "BSD-3", "Proprietary"],
        { placeHolder: "Select License" },
      );
      if (!license) {
        return;
      }

      const useDocker = await vscode.window.showQuickPick(["n", "y"], {
        placeHolder: "Use Docker?",
      });
      if (!useDocker) {
        return;
      }

      const targetFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Folder to Save Project",
      });
      if (!targetFolder || targetFolder.length === 0) {
        return;
      }

      const outputDir = targetFolder[0].fsPath;
      const projectSlug = projectName
        .toLowerCase()
        .replace(/ /g, "_")
        .replace(/-/g, "_");
      const projectPath = path.join(outputDir, projectSlug);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Python Project...",
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Running template engine..." });

          const command =
            `cookiecutter "${templatePath}" --no-input -o "${outputDir}" ` +
            `project_name="${projectName}" ` +
            `project_short_description="${projectDescription}" ` +
            `full_name="${fullName}" ` +
            `email="${email}" ` +
            `github_username="${githubUsername}" ` +
            `version="${version}" ` +
            `python_version="${detectedVersion}" ` +
            `actual_python_path="${interpreterPath}" ` +
            `license="${license}" ` +
            `use_docker="${useDocker}"`;

          await execPromise(command);

          const vscodeFolder = path.join(projectPath, ".vscode");
          if (!fs.existsSync(vscodeFolder)) {
            fs.mkdirSync(vscodeFolder, { recursive: true });
          }
          const relativeInterpreterPath =
            process.platform === "win32"
              ? ".venv/Scripts/python.exe"
              : ".venv/bin/python";

          const settings = {
            "python.defaultInterpreterPath": relativeInterpreterPath,
            "python.terminal.activateEnvInCurrentTerminal": true,
            "python.testing.pytestEnabled": true,
            "python.testing.unittestEnabled": false,
            "python.analysis.extraPaths": ["./src"],
          };

          fs.writeFileSync(
            path.join(vscodeFolder, "settings.json"),
            JSON.stringify(settings, null, 4),
          );
        },
      );

      if (fs.existsSync(projectPath)) {
        const markerFile = path.join(projectPath, ".vsc_success");
        fs.writeFileSync(markerFile, projectName);

        vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(projectPath),
          false,
        );
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Initialization Error: ${error.message}`);
    }
  }

  private async getAvailableInterpreters(): Promise<vscode.QuickPickItem[]> {
    const interpreters: vscode.QuickPickItem[] = [];
    const seenPaths = new Set<string>();

    try {
      if (process.platform === "win32") {
        try {
          const { stdout } = await execPromise("py -0p");
          const lines = stdout.trim().split("\n");
          for (const line of lines) {
            const match = line.match(/^\s*-([\d.]+)\s+(.*)$/);
            if (match) {
              const p = match[2].trim();
              const lowerPath = p.toLowerCase();
              if (
                lowerPath.includes("programs\\python") &&
                !seenPaths.has(lowerPath)
              ) {
                interpreters.push({ label: match[1], description: p });
                seenPaths.add(lowerPath);
              }
            }
          }
        } catch (e) {}
      }

      const findCmd =
        process.platform === "win32"
          ? "where python"
          : "which -a python3 python";
      try {
        const { stdout } = await execPromise(findCmd);
        const paths = stdout.trim().split(/\r?\n/);
        for (let p of paths) {
          p = p.trim();
          const lowerPath = p.toLowerCase();

          if (
            lowerPath.includes("windowsapps") ||
            !lowerPath.includes("programs\\python")
          ) {
            continue;
          }

          if (!seenPaths.has(lowerPath) && fs.existsSync(p)) {
            try {
              const { stdout: verOut } = await execPromise(`"${p}" --version`);
              const ver = verOut.trim().replace("Python ", "");
              interpreters.push({ label: ver, description: p });
              seenPaths.add(lowerPath);
            } catch (e) {}
          }
        }
      } catch (e) {}
    } catch (e) {}

    interpreters.push({
      label: "$(folder-opened) Other...",
      description: "Manually browse for a Python executable",
    });

    return interpreters;
  }
}

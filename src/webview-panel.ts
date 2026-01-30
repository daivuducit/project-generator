import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

// Panel to host the project generator webview
export class ProjectGeneratorPanel {
  public static currentPanel: ProjectGeneratorPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  // Singleton pattern: private constructor
  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    this._panel = panel;

    this._panel.webview.html = this._getHtmlContent(
      this._panel.webview,
      extensionUri,
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "generateProject":
            await this._handleProjectGeneration(message.data, context);
            break;
        }
      },
      null,
      this._disposables,
    );
  }
  // Static method to create or show the panel
  public static createOrShow(context: vscode.ExtensionContext) {
    if (ProjectGeneratorPanel.currentPanel) {
      ProjectGeneratorPanel.currentPanel._panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "projectGenerator",
      "Project Generator",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "src", "webview"),
        ],
      },
    );

    ProjectGeneratorPanel.currentPanel = new ProjectGeneratorPanel(
      panel,
      context.extensionUri,
      context,
    );
  }
  // Helper method to show messages
  private showMessage(message: string, isError: boolean = false): void {
    if (isError) {
      vscode.window.showErrorMessage(message);
    } else {
      vscode.window.showInformationMessage(message);
    }
  }
  // Handle project generation requests
  private async _handleProjectGeneration(
    data: any,
    context: vscode.ExtensionContext,
  ) {
    const { language, formData } = data;

    try {
      const targetFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Folder to Save Project",
      });

      if (!targetFolder || targetFolder.length === 0) {
        this._panel.webview.postMessage({
          command: "error",
          message: "No folder selected",
        });
        return;
      }

      const outputDir = targetFolder[0].fsPath;

      if (language === "C") {
        await this._generateCProject(formData, outputDir, context);
      } else if (language === "Java") {
        await this._generateJavaProject(formData, outputDir, context);
      } else if (language === "Python") {
        await this._generatePythonProject(formData, outputDir, context);
      }

      this._panel.webview.postMessage({
        command: "success",
        message: "Project generated successfully!",
      });
    } catch (error: any) {
      this._panel.webview.postMessage({
        command: "error",
        message: error.message,
      });
    }
  }
  // C PROJECT GENERATOR
  private async _generateCProject(
    formData: any,
    outputDir: string,
    context: vscode.ExtensionContext,
  ) {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execPromise = promisify(exec);

    let rawName = formData.projectName;
    let author = formData.author;
    let github = formData.github;
    const course = formData.course;
    // auto-detect author and github if not provided
    if (!author || author === "Your Name") {
      try {
        const ghResult = await execPromise("gh api user --jq .login");
        if (ghResult.stdout && ghResult.stdout.trim()) {
          author = ghResult.stdout.trim();
          github = ghResult.stdout.trim();
        }
      } catch (e) {
        try {
          const gitResult = await execPromise("git config --global user.name");
          if (gitResult.stdout && gitResult.stdout.trim()) {
            author = gitResult.stdout.trim();
            github = gitResult.stdout.trim();
          }
        } catch (e2) {
          const osUser =
            process.platform === "win32"
              ? process.env.USERNAME
              : process.env.USER;
          author = osUser || "windows";
          github = osUser || "windows";
        }
      }
    }
    // default github to author if still not set
    if (!github || github === "your-github") {
      github = author;
    }
    // locate template path
    const templatePath = path.join(
      context.globalStorageUri.fsPath,
      "project-template",
      "C",
    );
    // check template path exists
    if (!fs.existsSync(templatePath)) {
      this.showMessage("C template not found.", true);
      return;
    }
    // sanitize project name to create slug
    const projectSlug = rawName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const projectPath = path.join(outputDir, projectSlug);
    // run cookiecutter
    try {
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
            `github_username="${github}" ` +
            `course="${course}"`;

          await execPromise(command);
        },
      );
      // open the generated project
      if (fs.existsSync(projectPath)) {
        const markerFile = path.join(projectPath, ".vsc_success");
        fs.writeFileSync(markerFile, rawName);

        await vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(projectPath),
          false,
        );
      }
    } catch (err: any) {
      this.showMessage(`C project generation failed: ${err.message}`, true);
      throw err;
    }
  }

  // JAVA PROJECT GENERATOR
  private async _generateJavaProject(
    formData: any,
    outputDir: string,
    context: vscode.ExtensionContext,
  ) {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execPromise = promisify(exec);

    const templatePath = path.join(
      context.globalStorageUri.fsPath,
      "project-template",
      "java",
    );

    try {
      if (!fs.existsSync(templatePath)) {
        this.showMessage(
          "Java templates not found. Please update templates first.",
          true,
        );
        return;
      }

      let finalTemplatePath: string;

      if (formData.course === "PRO192") {
        finalTemplatePath = path.join(templatePath, "maven", "PRO192-template");
      } else if (formData.course === "PRJ301") {
        finalTemplatePath = path.join(templatePath, "maven", "PRJ301-template");
      } else {
        this.showMessage(`Unknown course: ${formData.course}`, true);
        return;
      }

      // Verify cookiecutter.json exists
      const cookiecutterPath = path.join(
        finalTemplatePath,
        "cookiecutter.json",
      );
      if (!fs.existsSync(cookiecutterPath)) {
        this.showMessage(
          `Template not found at: ${finalTemplatePath}\n\nPlease check:\n1. Template structure is correct\n2. Update templates from repository`,
          true,
        );
        return;
      }

      console.log("Using template path:", finalTemplatePath);

      // Parse cookiecutter.json and build INPUTS
      const cookiecutterConfig = JSON.parse(
        fs.readFileSync(cookiecutterPath, "utf8"),
      );

      const inputs: { [key: string]: string } = {};

      // Collect inputs from cookiecutter.json
      for (const [key, defaultValue] of Object.entries(cookiecutterConfig)) {
        // Skip cookiecutter internal keys
        if (
          key === "_extensions" ||
          key === "_templates" ||
          key === "_copy_without_render"
        ) {
          continue;
        }

        // Skip fields with template expressions
        if (
          typeof defaultValue === "string" &&
          defaultValue.startsWith("{{") &&
          defaultValue.endsWith("}}")
        ) {
          continue;
        }

        let inputValue: string;

        const formFieldMap: { [key: string]: string } = {
          project_name: formData.projectName,
          name: formData.projectName,

          author: formData.author || "Your Name",
          github_username: formData.github || "your-github",

          // Build system
          build_system: formData.buildSystem,

          java_version: formData.javaVersion,
          jdk_version: formData.javaVersion,
          jdk: formData.javaVersion,

          main_filename: formData.mainClassName || "Main",

          main_servlet_name: formData.mainClassName || "MainServlet",
          main_class_name: formData.mainClassName || "Main",
          main_class: formData.mainClassName || "Main",

          group_id: "com.example",
          artifact_id:
            formData.projectName?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
            "myproject",

          server: formData.server,
          application_server: formData.server,
          database: formData.database,
          mvc_pattern: formData.mvc,
          mvc: formData.mvc,
          jstl: formData.jstl ? "y" : "n",
          include_jstl: formData.jstl ? "y" : "n",

          language: "Java",
          add_sample_code: formData.addSampleCode ? "y" : "n",
          course: formData.course,
        };

        if (formFieldMap[key] !== undefined) {
          inputValue = formFieldMap[key];
        } else if (Array.isArray(defaultValue)) {
          inputValue = defaultValue[0] as string;
        } else {
          inputValue = String(defaultValue);
        }

        inputs[key] = inputValue;
      }

      // Verify project name
      const projectName = inputs.project_name || inputs.name || "java-project";
      const projectSlug = projectName
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/_/g, "-");
      const projectPath = path.join(outputDir, projectSlug);

      console.log("📋 Cookiecutter inputs:", inputs); // Debug log

      // Run cookiecutter
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Generating ${formData.course} Project...`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Running template engine..." });

          // Build cookiecutter command with all inputs
          let command = `cookiecutter "${finalTemplatePath}" --no-input -o "${outputDir}"`;

          for (const [key, value] of Object.entries(inputs)) {
            command += ` ${key}="${value}"`;
          }

          console.log("Cookiecutter command:", command); // Debug log

          await execPromise(command);

          progress.report({ message: "Project generated successfully!" });
        },
      );

      // Open PROJECT
      if (fs.existsSync(projectPath)) {
        const markerFile = path.join(projectPath, ".vsc_success");
        fs.writeFileSync(markerFile, projectName);

        await vscode.commands.executeCommand(
          "vscode.openFolder",
          vscode.Uri.file(projectPath),
          false,
        );
      } else {
        // Debug: Check what folders were created
        console.error("Project path not found:", projectPath);
        const outputDirContents = fs
          .readdirSync(outputDir, { withFileTypes: true })
          .filter((item) => item.isDirectory())
          .map((item) => item.name);
        console.error("Folders in output directory:", outputDirContents);

        // Try to find and open the created folder
        if (outputDirContents.length > 0) {
          // Find the most recently created folder
          const folders = outputDirContents
            .map((name) => ({
              name,
              path: path.join(outputDir, name),
              stats: fs.statSync(path.join(outputDir, name)),
            }))
            .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

          const recentFolder = folders[0];
          console.log("Opening most recent folder:", recentFolder.name);

          const markerFile = path.join(recentFolder.path, ".vsc_success");
          fs.writeFileSync(markerFile, projectName);

          await vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.file(recentFolder.path),
            false,
          );
        } else {
          this.showMessage(
            "Project created but could not find the output folder.",
            true,
          );
        }
      }
    } catch (error: any) {
      console.error("Full error:", error); // Debug log
      this.showMessage(`Java Project Generation Error: ${error.message}`, true);
      throw error;
    }
  }
  // PYTHON PROJECT GENERATOR
  private async _generatePythonProject(
    formData: any,
    outputDir: string,
    context: vscode.ExtensionContext,
  ) {
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execPromise = promisify(exec);

    const templatePath = path.join(
      context.globalStorageUri.fsPath,
      "project-template",
      "python",
    );
    // check template path exists
    if (!fs.existsSync(templatePath)) {
      this.showMessage("Python template not found.", true);
      return;
    }
    // extract form data
    const projectName = formData.projectName;
    const projectDescription = formData.description;
    const fullName = formData.fullName;
    const email = formData.email;
    const githubUsername = formData.github;
    const version = formData.version;
    const detectedVersion = formData.pythonVersion;
    const interpreterPath = formData.interpreterPath;
    const license = formData.license;
    const useDocker = formData.useDocker;
    const course = formData.course;

    // sanitize project name to create slug
    const projectSlug = projectName
      .toLowerCase()
      .replace(/ /g, "_")
      .replace(/-/g, "_");
    const projectPath = path.join(outputDir, projectSlug);

    // run cookiecutter
    try {
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
            `use_docker="${useDocker}" ` +
            `course="${course}"`;

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
      // open the generated project
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
      this.showMessage(`Initialization Error: ${error.message}`, true);
      throw error;
    }
  }

  // Generate HTML content for the webview
  private _getHtmlContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ): string {
    const htmlPath = vscode.Uri.joinPath(
      extensionUri,
      "src",
      "webview",
      "index.html",
    );
    const cssPath = vscode.Uri.joinPath(
      extensionUri,
      "src",
      "webview",
      "styles.css",
    );
    const jsPath = vscode.Uri.joinPath(
      extensionUri,
      "src",
      "webview",
      "script.js",
    );

    const cssUri = webview.asWebviewUri(cssPath);
    const jsUri = webview.asWebviewUri(jsPath);

    let htmlContent = fs.readFileSync(htmlPath.fsPath, "utf8");

    htmlContent = htmlContent
      .replace("{{cssUri}}", cssUri.toString())
      .replace("{{jsUri}}", jsUri.toString());

    return htmlContent;
  }
  // Dispose resources
  public dispose() {
    ProjectGeneratorPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}

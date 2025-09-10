import * as vscode from 'vscode';
import { exec } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import * as path from 'path';

interface PintCache {
	[workspaceRoot: string]: string | null;
}

let pintPathCache: PintCache = {};

interface PintConfig {
	enabled: boolean;
	formatOnType: boolean;
	formatOnPaste: boolean;
	timeout: number;
}

/**
 * Get configuration for the extension
 */
function getConfiguration(): PintConfig {
	const config = vscode.workspace.getConfiguration('phpFormatter');
	return {
		enabled: config.get<boolean>('enabled', true),
		formatOnType: config.get<boolean>('formatOnType', false),
		formatOnPaste: config.get<boolean>('formatOnPaste', false),
		timeout: config.get<number>('timeout', 30000)
	};
}

/**
 * Find the workspace folder that contains the given file
 */
function findWorkspaceFolder(filePath: string): vscode.WorkspaceFolder | null {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		return null;
	}

	// Find the workspace folder that contains this file
	for (const folder of workspaceFolders) {
		if (filePath.startsWith(folder.uri.fsPath)) {
			return folder;
		}
	}

	return workspaceFolders[0]; // Fallback to first workspace
}

/**
 * Find the project root (containing composer.json) for a given file
 */
function findProjectRoot(filePath: string, workspaceRoot: string): string {
	let currentDir = path.dirname(filePath);
	
	// Search upwards from the file location to the workspace root
	while (currentDir && currentDir.startsWith(workspaceRoot)) {
		if (existsSync(path.join(currentDir, 'composer.json'))) {
			return currentDir;
		}
		
		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			break; // Reached filesystem root
		}
		currentDir = parentDir;
	}
	
	return workspaceRoot; // Fallback to workspace root
}

/**
 * Recursively search for vendor/bin/pint inside a directory
 */
function findPintBinaryRecursive(root: string): string | null {
	try {
		const entries = readdirSync(root, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(root, entry.name);

			if (entry.isDirectory()) {
				// Check if this is vendor directory with pint
				if (entry.name === 'vendor') {
					const candidate = path.join(fullPath, 'bin', 'pint');
					if (existsSync(candidate)) {
						return candidate;
					}
				}

				// Don't recurse into common directories that won't contain vendor
				if (!['node_modules', '.git', 'storage', 'bootstrap/cache'].includes(entry.name)) {
					const found = findPintBinaryRecursive(fullPath);
					if (found) {
						return found;
					}
				}
			}
		}
	} catch (error) {
		// Handle permission errors or other filesystem issues
		console.warn(`Error searching directory ${root}:`, error);
	}

	return null;
}

/**
 * Ensure Pint is installed for the given project root
 */
function ensurePintInstalled(projectRoot: string): Promise<string> {
	return new Promise((resolve, reject) => {
		// Check cache first
		if (pintPathCache[projectRoot] && existsSync(pintPathCache[projectRoot]!)) {
			resolve(pintPathCache[projectRoot]!);
			return;
		}

		const pintPath = findPintBinaryRecursive(projectRoot);
		if (pintPath) {
			pintPathCache[projectRoot] = pintPath;
			resolve(pintPath);
			return;
		}

		// Ask user if they want to install Pint
		vscode.window.showInformationMessage(
			'Laravel Pint not found. Install it?',
			'Install',
			'Cancel'
		).then(selection => {
			if (selection !== 'Install') {
				reject(new Error('User cancelled Pint installation'));
				return;
			}

			vscode.window.showInformationMessage('Installing Laravel Pint...');
			exec('composer require laravel/pint --dev', { cwd: projectRoot }, (err, _stdout, stderr) => {
				if (err) {
					vscode.window.showErrorMessage(`Failed to install Pint: ${stderr}`);
					reject(err);
				} else {
					const installedPath = findPintBinaryRecursive(projectRoot);
					if (installedPath) {
						pintPathCache[projectRoot] = installedPath;
						vscode.window.showInformationMessage('Laravel Pint installed successfully.');
						resolve(installedPath);
					} else {
						reject(new Error('Pint binary not found after install.'));
					}
				}
			});
		});
	});
}

/**
 * Format a file using Pint
 */
function formatWithPint(filePath: string, pintPath: string, timeout: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const projectRoot = path.dirname(path.dirname(pintPath)); // vendor/bin/../..
		const relativeFilePath = path.relative(projectRoot, filePath);
		
		// Use --test to get the formatted output without modifying the file
		const command = `"${pintPath}" "${relativeFilePath}" --test`;
		
		const execOptions = {
			cwd: projectRoot,
			timeout: timeout,
			encoding: 'utf8' as const
		};

		exec(command, execOptions, (err, stdout, stderr) => {
			if (err) {
				// Pint returns exit code 1 when files need formatting, which is normal
				if (err.code === 1 && stdout) {
					// File needs formatting, run actual format
					const formatCommand = `"${pintPath}" "${relativeFilePath}"`;
					exec(formatCommand, { cwd: projectRoot, timeout }, (formatErr, formatStdout) => {
						if (formatErr) {
							reject(new Error(`Pint format error: ${formatErr.message}`));
						} else {
							// Read the formatted file content
							const fs = require('fs');
							try {
								const formattedContent = fs.readFileSync(filePath, 'utf8');
								resolve(formattedContent);
							} catch (readErr) {
								reject(new Error(`Failed to read formatted file: ${readErr instanceof Error ? readErr.message : 'Unknown error'}`));
							}
						}
					});
				} else {
					reject(new Error(`Pint error: ${stderr || err.message}`));
				}
			} else {
				// File is already formatted, return original content
				const fs = require('fs');
				try {
					const content = fs.readFileSync(filePath, 'utf8');
					resolve(content);
				} catch (readErr) {
					reject(new Error(`Failed to read file: ${readErr instanceof Error ? readErr.message : 'Unknown error'}`));
				}
			}
		});
	});
}

/**
 * Document format provider for PHP files
 */
class PintDocumentFormattingEditProvider implements vscode.DocumentFormattingEditProvider {
	async provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): Promise<vscode.TextEdit[]> {
		const config = getConfiguration();
		if (!config.enabled) {
			return [];
		}

		const filePath = document.fileName;
		const workspaceFolder = findWorkspaceFolder(filePath);
		
		if (!workspaceFolder) {
			return [];
		}

		try {
			const projectRoot = findProjectRoot(filePath, workspaceFolder.uri.fsPath);
			const pintPath = await ensurePintInstalled(projectRoot);
			const formattedContent = await formatWithPint(filePath, pintPath, config.timeout);

			// Create edit to replace entire document content
			const fullRange = new vscode.Range(
				document.positionAt(0),
				document.positionAt(document.getText().length)
			);

			return [vscode.TextEdit.replace(fullRange, formattedContent)];
		} catch (error) {
			vscode.window.showErrorMessage(`PHP formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return [];
		}
	}
}

/**
 * Activate extension
 */
export function activate(context: vscode.ExtensionContext) {
	const config = getConfiguration();
	
	if (!config.enabled) {
		return;
	}

	// Register document format provider
	const formatProvider = new PintDocumentFormattingEditProvider();
	const documentSelector: vscode.DocumentSelector = { language: 'php', scheme: 'file' };
	
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider(documentSelector, formatProvider)
	);

	// Watch for workspace folder changes to clear cache
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			pintPathCache = {}; // Clear cache when workspace changes
		})
	);

	// Watch vendor folders to invalidate cache
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const pattern = new vscode.RelativePattern(folder, '**/vendor');
			const watcher = vscode.workspace.createFileSystemWatcher(pattern);
			
			watcher.onDidCreate(() => {
				delete pintPathCache[folder.uri.fsPath];
			});
			watcher.onDidDelete(() => {
				delete pintPathCache[folder.uri.fsPath];
			});
			watcher.onDidChange(() => {
				delete pintPathCache[folder.uri.fsPath];
			});
			
			context.subscriptions.push(watcher);
		}
	}

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('phpFormatter.formatDocument', async () => {
			const activeEditor = vscode.window.activeTextEditor;
			if (activeEditor && activeEditor.document.languageId === 'php') {
				await vscode.commands.executeCommand('editor.action.formatDocument');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('phpFormatter.clearCache', () => {
			pintPathCache = {};
			vscode.window.showInformationMessage('PHP Formatter cache cleared.');
		})
	);


}

export function deactivate() {
	pintPathCache = {};
}

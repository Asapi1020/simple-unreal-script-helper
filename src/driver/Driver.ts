import { FileSystem } from "./FileSystem";
import { VSCode } from "./VSCode";

export class Driver {
	public vscode: VSCode;
	public fileSystem: FileSystem;

	constructor(extensionPath: string) {
		this.vscode = new VSCode(extensionPath);
		this.fileSystem = new FileSystem();
	}
}

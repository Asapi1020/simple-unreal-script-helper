import {
	type Dirent,
	type WriteFileOptions,
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	readSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export class FileSystem {
	public exists(filePath: string): boolean {
		return existsSync(filePath);
	}

	public readFile(filePath: string, encoding: BufferEncoding): string {
		if (!this.exists(filePath)) {
			throw new Error(`File does not exist: ${filePath}`);
		}

		try {
			return readFileSync(filePath, encoding);
		} catch (error) {
			throw new Error(`Error reading file ${filePath}: ${error}`);
		}
	}

	public readDir(dirPath: string): Dirent<string>[] {
		if (!this.exists(dirPath)) {
			throw new Error(`Directory does not exist: ${dirPath}`);
		}

		const entries = readdirSync(dirPath, {
			withFileTypes: true,
		});
		return entries;
	}

	public writeFile(filePath: string, data: string, options?: WriteFileOptions): void {
		const dir = dirname(filePath);
		if (!this.exists(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(filePath, data, options);
	}

	public detectEncoding(fileName: string): "utf8" | "utf16le" {
		if (!this.exists(fileName)) {
			throw new Error(`File does not exist: ${fileName}`);
		}

		const buffer = Buffer.alloc(2);
		let fileDescriptor: number | undefined;
		try {
			fileDescriptor = openSync(fileName, "r");
			readSync(fileDescriptor, buffer, 0, 2, 0);
		} finally {
			if (fileDescriptor !== undefined) {
				closeSync(fileDescriptor);
			}
		}

		if (buffer[0] === 0xef && buffer[1] === 0xbb) {
			return "utf8";
		}
		if (buffer[0] === 0xff && buffer[1] === 0xfe) {
			return "utf16le";
		}

		return "utf8";
	}
}

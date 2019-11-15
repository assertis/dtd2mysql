import {PromiseSFTP} from "./PromiseSFTP";
import {FileEntry} from "ssh2-streams";
import {DatabaseConnection} from "../database/DatabaseConnection";

/**
 * Common interface to manage file processing
 */
export class SourceManager {

    public constructor(public readonly sftp: PromiseSFTP,
                       private readonly db: DatabaseConnection) {

    }

    public async getRemoteFiles(directory: string): Promise<FileEntry[]> {
        return this.sftp.readdir(directory);
    }

    public async getLastProcessedFile(): Promise<string | undefined> {
        try {
            const [[log]] = await this.db.query("SELECT * FROM log ORDER BY id DESC LIMIT 1");

            return log ? log.filename : undefined;
        }
        catch (err) {
            return undefined;
        }
    }

    /**
     * Do a directory listing to get the filename of the last full refresh
     */
    public getFilesToProcess(dir: FileEntry[], lastProcessed: string | undefined): string[] {
        dir.sort((a: FileEntry, b: FileEntry) => b.attrs.mtime - a.attrs.mtime);

        const lastRefresh = dir.findIndex(i => i.filename.charAt(4) === "F" || i.filename.startsWith("RJRG"));
        const lastFile = dir.findIndex(i => i.filename === lastProcessed);
        const files = lastFile > -1 && (lastFile <= lastRefresh || lastRefresh < 0)
            ? dir.slice(0, lastFile)
            : dir.slice(0, lastRefresh + 1);

        return files.map(f => f.filename).reverse();
    }

    public async end() {
        await this.sftp.end();
        await this.db.end();
    }
}

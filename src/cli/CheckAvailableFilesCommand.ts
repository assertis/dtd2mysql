import {CLICommand} from "./CLICommand";
import {PromiseSFTP} from "../sftp/PromiseSFTP";
import {faresPath, timetablePath} from "../sftp/Paths";
import {SourceManager} from "../sftp/SourceManager";

export class CheckAvailableFilesCommand implements CLICommand  {

    public constructor(
        private readonly ftpSource: PromiseSFTP,
        private readonly faresFileManager: SourceManager,
        private readonly timetableFileManager: SourceManager
    ) {}

    public async run(argv: string[]): Promise<any> {
        let lastProcessedFile, allFiles;
        // Fares
        lastProcessedFile = await this.faresFileManager.getLastProcessedFile();
        allFiles = await this.faresFileManager.getRemoteFiles(faresPath);
        const fares = await this.faresFileManager.getFilesToProcess(allFiles, lastProcessedFile);
        // Timetables
        lastProcessedFile = await this.timetableFileManager.getLastProcessedFile();
        allFiles = await this.timetableFileManager.getRemoteFiles(timetablePath);
        const timetables = await this.timetableFileManager.getFilesToProcess(allFiles, lastProcessedFile);

        if(fares.length > 0 && timetables.length > 0) {
            await this.end();
            console.log("Process the data");
        } else {
            await this.end();
            throw new Error("No data to update");
        }
    }


    private async end() {
        await this.faresFileManager.end();
        await this.timetableFileManager.end();
    }
}

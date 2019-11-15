import {CLICommand} from "./CLICommand";
import {faresPath, timetablePath} from "../sftp/Paths";
import {SourceManager} from "../sftp/SourceManager";

export class CheckAvailableFilesCommand implements CLICommand  {

    public constructor(
        private readonly faresSource: SourceManager,
        private readonly timetableSource: SourceManager
    ) {}

    public async run(argv: string[]): Promise<any> {
        let lastProcessedFile, allFiles;
        // Fares
        lastProcessedFile = await this.faresSource.getLastProcessedFile();
        allFiles = await this.faresSource.getRemoteFiles(faresPath);
        const fares = await this.faresSource.getFilesToProcess(allFiles, lastProcessedFile);
        // Timetables
        lastProcessedFile = await this.timetableSource.getLastProcessedFile();
        allFiles = await this.timetableSource.getRemoteFiles(timetablePath);
        const timetables = await this.timetableSource.getFilesToProcess(allFiles, lastProcessedFile);

        if(fares.length > 0 && timetables.length > 0) {
            await this.end();
            console.log("Process the data");
        } else {
            await this.end();
            /**
             * We throw to stop executing any other command after check availability.
             */
            throw new Error("No data to update");
        }
    }


    private async end() {
        await this.faresSource.end();
        await this.timetableSource.end();
    }
}

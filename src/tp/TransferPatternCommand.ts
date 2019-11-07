import {CLICommand} from "../cli/CLICommand";
import * as AWS from 'aws-sdk';

export class TransferPatternCommand implements CLICommand {

    public constructor(private readonly lambda: AWS.Lambda) {

    }

    public async run(argv: string[]): Promise<any> {
        if (process.env.NODE_ENV === 'test') {
           this.lambda.invoke(this.transferPatternStartLambda, function(err, data) {
               if (err) console.log(err, err.stack); // an error occurred
               else     console.log(data);           // successful response
           });
        }
    }

    private get transferPatternStartLambda() {
        return {
            FunctionName: "transfer_patterns",
            InvocationType: "Event",
            LogType: "Tail",
            Payload: Buffer.from(""),
        }
    }
}

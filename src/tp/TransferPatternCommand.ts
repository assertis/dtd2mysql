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

    private get testMail() {
        return {
            FunctionName: "mailingService-send-dev",
            InvocationType: "Event",
            LogType: "Tail",
            Payload: Buffer.from(JSON.stringify({
                from: "Mailgun Sandbox <postmaster@assertis.co.uk>",
                to: "Bartlomiej Olewinski <lukasz.nowak@assertis.co.uk>",
                subject: "Test skryptu",
                text: "Congratulations Bartlomiej Olewinski, you just sent an email with Mailgun!  You are truly awesome!",
                html: "<strong>This is an example of message send via API Gateway</strong> Let`s see how <i>it will look like</i><p>Next paragraph</p>"
            })),
        }
    }
}

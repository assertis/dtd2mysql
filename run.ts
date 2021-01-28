import {Container} from "./src/cli";

const run = async () => {
  const container = new Container();
  const command = await container.getCommand('--gtfs');

  await command.run([]);
}

run().then().catch();

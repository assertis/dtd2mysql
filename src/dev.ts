import {Container} from "./cli/Container";


const container = new Container();

container.getOfflineDataProcessor().removeOutdatedOfflineDatabase();
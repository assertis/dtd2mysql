/*
This file is responsible for switching views in original database like `ojp`, `routeing`
etc. from for example `ojp_2019_02_02` to `ojp_2019_02_03`
So in case of data failure we can simply switch views between old still working databases
 */
import {Container} from "./cli/Container";
import {viewsSqlFactory} from "../config";
import {ojpViews} from "../config/gtfs/views";
import {OfflineDataProcessor} from "./database/OfflineDataProcessor";

const container = new Container();

const f = async () => {

  const databaseWithViews = process.argv[2];
  const databaseWithData = process.argv[3];

  if (databaseWithViews.length === 0 ||
    databaseWithData.length === 0) {
    throw new Error('Missing arguments npm run dataVersion {dbWithViews} {dbWithData}');
  }
  process.env.DATABASE_NAME = databaseWithViews;

  console.info('[INFO] Database with views => ', databaseWithViews);
  console.info('[INFO] Database with data => ', databaseWithData);
  const offlineDataProcessor = new OfflineDataProcessor(
    databaseWithViews,
    container.databaseConfiguration
  );
  const viewsSql = offlineDataProcessor.getViews(databaseWithData);
  console.info('[INFO] SQL Query => ', viewsSql);

// Realise the query
  try {
    const result = await container.getDatabaseConnection().query(viewsSql);
    console.info('[INFO] Query finished.')
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
};

f();
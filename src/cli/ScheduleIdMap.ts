import {DatabaseConnection} from "../database/DatabaseConnection";

export class ScheduleIdMap {

  private index: { [key: string]: number } = {};

  constructor(
    protected readonly db: DatabaseConnection,
  ) {
  }

  /**
   * Load a map of schedule primary key to schedule id.
   */
  public async load(): Promise<ScheduleIdMap> {
    this.index = {};

    const [records] = await this.db.query(
      "SELECT id, train_uid, DATE_FORMAT(runs_from, '%Y-%m-%d') AS runs_from, stp_indicator FROM `schedule` ORDER BY id desc"
    );

    records.forEach(record => {
      const id = parseInt(record['id']);
      const key = this.getKey(record['train_uid'], record['runs_from'], record['stp_indicator']);

      this.index[key] = id;
    });

    return this;
  }

  private getKey(uid: string, date: string, stp: string): string {
    return uid + '_' + date + '_' + stp;
  }

  public getId(uid: string, date: string, stp: string): number {
    const key = this.getKey(uid, date, stp);
    const found = this.index[key];

    if (found === undefined) {
      throw new Error('Could not find existing schedule record id for key ' + key);
    }

    return found;
  }
}

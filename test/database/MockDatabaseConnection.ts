import { DatabaseConnection } from '../../src/database/DatabaseConnection';

export class MockDatabaseConnection implements DatabaseConnection {
  public readonly queries: string[] = [];
  private readonly responses: object = {};

  query(sql: string, parameters?: any[]): Promise<any[]> {
    this.queries.push(sql);

    let value = [] as any[];
    if (sql in this.responses) {
      value = [this.responses[sql]];
      delete this.responses[sql];
    }
    return Promise.resolve(value);
  }

  end(): Promise<void> {
    return Promise.resolve();
  }

  async getConnection(): Promise<DatabaseConnection> {
    return this;
  }

  async release(): Promise<void> {

  }

  public addMockResponse(query: string, result: any[]) {
    this.responses[query] = result;
  }
}

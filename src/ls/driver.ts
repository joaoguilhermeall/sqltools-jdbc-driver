import AbstractDriver from "@sqltools/base-driver";
import {
  Arg0,
  ContextValue,
  IBaseQueries,
  IConnection,
  IConnectionDriver,
  IQueryOptions,
  NSDatabase,
} from "@sqltools/types";
import JDBC from "jdbc/lib/jdbc";
import jinst from "jdbc/lib/jinst";
import { v4 as generateId } from "uuid";
import { WorkspaceFolder } from "vscode-languageserver-protocol";
import {
  IConnectionObject,
  IDialect,
  IDialectNames,
  IJdbc,
  IJdbcConfig,
} from "../types";
import dialects from "./dialects";

class JDBCSqlToolsClient extends JDBC {
  constructor(config: IJdbcConfig) {
    super(config);
  }

  executeQueryAndRelease = async (query: string) => {
    let resultList: any;
    let connection: IConnectionObject;

    try {
      connection = await new Promise<IConnectionObject>((resolve, reject) => {
        (this as unknown as IJdbc).reserve((err, connObj) => {
          if (err) {
            return reject(err);
          }
          resolve(connObj);
        });
      });

      resultList = await new Promise((resolve, reject) => {
        connection.conn.createStatement((err, statement) => {
          if (err) {
            return reject(err);
          }

          statement.execute(query.toString(), (err, resultset) => {
            if (err) {
              statement.close(() => {});
              return reject(err);
            }

            resultset.toObjArray((err, results) => {
              statement.close(() => {});

              if (err) {
                return reject(err);
              }

              if (typeof results === "undefined" || results === null) {
                return resolve([{ results: "No results" }] as any);
              } else if (
                typeof results === "string" ||
                typeof results === "number"
              ) {
                return resolve([{ results }] as any);
              }

              return resolve(results);
            });
          });
        });
      });
    } catch (error) {
      if (connection) {
        console.log("Releasing connection", connection.uuid);
        (this as unknown as IJdbc).release(connection, () => {});
      }
      throw error;
    } finally {
      if (connection) {
        console.log("Releasing connection", connection.uuid);
        (this as unknown as IJdbc).release(connection, () => {});
      }
    }

    return resultList;
  };
}

export default class JdbcDriver
  extends AbstractDriver<IJdbc, any>
  implements IConnectionDriver
{
  dialectName: IDialectNames;
  dialect: IDialect;
  queries: IBaseQueries;
  jdbcClient: IJdbc;
  jdbcConfig: IJdbcConfig;

  constructor(
    public credentials: IConnection,
    getWorkSpaceFolders: () => Promise<WorkspaceFolder[]>
  ) {
    super(credentials, getWorkSpaceFolders);

    this.dialectName = this.credentials.dialectName;
    this.dialect = dialects[this.dialectName];
    this.queries = dialects[this.dialectName].queries;

    if (!jinst.isJvmCreated()) {
      jinst.addOption("-Xrs");
      jinst.setupClasspath([this.credentials.driverJarPath]);
    }

    this.jdbcConfig = {
      url: this.credentials.jdbcUrl,
      drivername: this.credentials.driverJarClass,
      minpoolsize: 1,
      maxpoolsize: 5,
      user: this.credentials.jdbcUsername,
      password: this.credentials.jdbcPassword,
      properties: {},
    };

    for (const line in this.credentials.jdbcAdditionalProperties?.split("\n")) {
      if (line.trim() === "") {
        continue;
      }

      const [key, value] = line.split("=");
      this.jdbcConfig.properties[key] = value;
    }

    this.jdbcClient = new JDBCSqlToolsClient(this.jdbcConfig) as IJdbc;
  }

  public open = async () => {
    if (this.connection) {
      return await this.connection;
    }

    await new Promise<void>((resolve, reject) => {
      this.jdbcClient.initialize((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    this.connection = Promise.resolve(this.jdbcClient);

    return await this.connection;
  };

  public close = async () => {
    if (!this.connection) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.jdbcClient.purge((err) => {
        if (err) {
          return reject(err);
        }

        this.connection = null;
        resolve();
      });
    });
  };

  public splitQueries(query: string) {
    return query.split?.(/;/g) || [];
  }

  public singleQuery: (typeof AbstractDriver)["prototype"]["singleQuery"] =
    async (query: string, opt: any = {}) => {
      let results: Record<string, any>[];
      try {
        results = await this.jdbcClient.executeQueryAndRelease(
          query.toString()
        );

        if (Array.isArray(results)) {
          return <NSDatabase.IResult>{
            cols: Object.keys(results[0]),
            connId: this.getId(),
            messages: [
              {
                date: new Date(),
                message: `Query ok with ${results.length} result`,
              },
            ],
            results: results,
            error: false,
            query: query.toString(),
            requestId: opt.requestId,
            resultId: generateId(),
          };
        } else {
          throw Error("Invalid resultset");
        }
      } catch (error) {
        return <NSDatabase.IResult>{
          cols: [],
          connId: this.getId(),
          messages: [
            this.prepareMessage([(error && error.message) || error, undefined]),
          ],
          results: [],
          error: true,
          rawError: error,
          query: query.toString(),
          requestId: opt.requestId,
          resultId: generateId(),
        };
      }
    };

  public query: (typeof AbstractDriver)["prototype"]["query"] = async (
    query,
    opt = {}
  ) => {
    const queries = this.splitQueries(query.toString());
    const resultsAgg: NSDatabase.IResult[] = [];

    for (const queryToExecute of queries) {
      if (!queryToExecute.trim()) {
        continue;
      }
      resultsAgg.push(await this.singleQuery(queryToExecute, opt));
    }

    return resultsAgg;
  };

  public async testConnection() {
    await this.query("SELECT 1", {});
  }

  public async getChildrenForItem({
    item,
    parent,
  }: Arg0<IConnectionDriver["getChildrenForItem"]>) {
    return await this.dialect?.getDialectChildren(
      await this.open(),
      item,
      parent
    );
  }

  public async searchItems(
    itemType: ContextValue,
    search: string,
    extraParams: any = {}
  ): Promise<NSDatabase.SearchableItem[]> {
    console.log("Searching items", itemType, search, extraParams);
    return await this.dialect.searchDialectItem(
      await this.open(),
      itemType,
      search,
      extraParams
    );
  }

  public async showRecords(
    table: NSDatabase.ITable,
    opt: IQueryOptions & { limit: number; page?: number }
  ): Promise<NSDatabase.IResult<any>[]> {
    console.log("Showing records", table.label);
    return await this.query(
      this.queries.fetchRecords({
        table,
        limit: opt.limit,
        offset: opt.page * opt.limit ?? 0,
      }),
      opt
    );
  }

  public async describeTable(
    metadata: NSDatabase.ITable,
    opt: IQueryOptions
  ): Promise<NSDatabase.IResult<any>[]> {
    console.log("Describing table", metadata.label);
    return await this.query(this.queries.describeTable(metadata), opt);
  }
}

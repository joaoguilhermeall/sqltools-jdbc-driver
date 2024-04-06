import JdbcDriver from "@sqltools-jdbc-driver/ls/driver";
import AbstractDriver from "@sqltools/base-driver";
import { ContextValue, IBaseQueries } from "@sqltools/types";

export type IDialectNames = "impala";

export interface IJdbcStatement {
  executeQuery: (
    query: string,
    callback: (err: Error, result: any) => void
  ) => void;
  execute: (query: string, callback: (err: Error, result: any) => void) => void;
  close: (callback: (err: Error) => void) => void;
}

export interface IJdbcConnection {
  createStatement: (
    callback: (err: Error, statement: IJdbcStatement) => void
  ) => void;
  close: (callback: (err: Error) => void) => void;
}

export type IConnectionObject = {
  uuid: string;
  conn: IJdbcConnection;
  keepalive: boolean;
};

export interface IJdbc {
  constructor: (config: IJdbcConfig) => void;
  initialize: (callback: (err: Error) => void) => void;
  reserve: (callback: (err: Error, conn: IConnectionObject) => void) => void;
  purge: (callback: (err: Error) => void) => void;
  release: (connObj: any, callback: (err: Error) => void) => void;
  executeQueryAndRelease?: (query: string) => Promise<Record<string, any>[]>;
}

export interface IDialect {
  queries: IBaseQueries;
  getDialectChildren: (
    jdbcClient: IJdbc,
    item: NSDatabase.SearchableItem,
    parent: NSDatabase.SearchableItem
  ) => Promise<MConnectionExplorer.IChildItem[]>;
  searchDialectItem: (
    jdbcClient: IJdbc,
    itemType: ContextValue,
    search: string,
    extraParams: any = {}
  ) => Promise<NSDatabase.SearchableItem[]>;
}

type IFormJdbcConnection = {
  dialectName: IDialectNames;
  jdbcUrl: string;
  driverJarPath: string;
  driverJarClass: string;
  jdbcUsername?: string;
  jdbcPassword?: string;
  minPoolSize?: number;
  maxPoolSize?: number;
  maxIdleTime?: number;
  jdbcAdditionalProperties?: string;
};

type IJdbcConfig = {
  url: string;
  drivername: string;
  minpoolsize: number;
  maxpoolsize: number;
  maxidle: number;
  keepalive: {
    interval: number;
    query: string;
    enabled: boolean;
  };
  user?: string;
  password?: string;
  properties?: {} & Record<string, any>;
};

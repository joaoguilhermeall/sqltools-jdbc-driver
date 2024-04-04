import queryFactory from "@sqltools/base-driver/dist/lib/factory";
import {
  ContextValue,
  IBaseQueries,
  MConnectionExplorer,
  NSDatabase,
} from "@sqltools/types";
import { IDialect, IJdbc } from "../../../types";

function escapeTableName(table: Partial<NSDatabase.ITable> | string) {
  let items: string[] = [];
  let tableObj =
    typeof table === "string" ? <NSDatabase.ITable>{ label: table } : table;
  tableObj.schema && items.push(`\`${tableObj.schema}\``);
  items.push(`\`${tableObj.label}\``);
  return items.join(".");
}

const describeTable: IBaseQueries["describeTable"] = queryFactory`
  DESCRIBE ${(p) => escapeTableName(p)}
`;

const fetchColumns: IBaseQueries["fetchColumns"] = queryFactory`
${(p) =>
  p?.table ? `SHOW COLUMNS IN ${p.tables} LIMIT ${p.limit || 100};` : ";"}
`;

const fetchRecords: IBaseQueries["fetchRecords"] = queryFactory`
SELECT *
FROM ${(p) => escapeTableName(p.table)}
LIMIT ${(p) => p.limit || 50};
`;

const countRecords: IBaseQueries["countRecords"] = queryFactory`
SELECT count(1) AS total
FROM ${(p) => escapeTableName(p.table)}
`;

const fetchFunctions: IBaseQueries["fetchFunctions"] = queryFactory`
;`;

const fetchTables: IBaseQueries["fetchTables"] = queryFactory`
SHOW TABLES ${(p) => (p.search ? `LIKE '${p.search}*'` : "")};
`;

const fetchViews: IBaseQueries["fetchTables"] = queryFactory`
SHOW TABLES ${(p) => (p.search ? `LIKE '${p.search}*'` : "")};
`;

const fetchDatabases: IBaseQueries["fetchDatabases"] = queryFactory`
SHOW DATABASES ${(p) => (p.search ? `LIKE '${p.search}*'` : "")};
`;

const searchTables: IBaseQueries["searchTables"] = queryFactory`
SHOW TABLES ${(p) => (p.search ? `LIKE '${p.search}*'` : "")};
`;

const searchColumns: IBaseQueries["searchColumns"] = queryFactory`
${(p) =>
  p?.tables?.length > 0
    ? `SHOW COLUMNS IN ${(p) => p.tables?.[0]} ${(p) =>
        p.search ? `LIKE '${p.search}*'` : ""};`
    : ";"}
`;

const queries = {
  describeTable,
  fetchColumns,
  fetchRecords,
  countRecords,
  fetchFunctions,
  fetchTables,
  fetchViews,
  fetchDatabases,
  searchTables,
  searchColumns,
};

type ImpalaDatabaseType = {
  name: string;
  comment: string;
};

const getDatabases = async (
  jdbcClient: IJdbc,
  search: string = ""
): Promise<ImpalaDatabaseType[]> => {
  return (await jdbcClient.executeQueryAndRelease(
    `SHOW DATABASES ${search ? `LIKE '${search}*'` : ""}`
  )) as ImpalaDatabaseType[];
};

type ImpalaTableType = { name: string };

const getTables = async (
  jdbcClient: IJdbc,
  database: string,
  search: string = ""
): Promise<ImpalaTableType[]> => {
  return (await jdbcClient.executeQueryAndRelease(
    `SHOW TABLES IN ${escapeTableName(database)} ${
      search ? `LIKE '${search}*'` : ""
    }`
  )) as ImpalaTableType[];
};

type ImpalaColumnType = {
  name: string;
  type: string;
  comment: string;
  primary_key?: "true" | "false";
  key_unique?: boolean;
  nullable?: "true" | "false";
  default_value?: any;
};

const getColumns = async (
  jdbcClient: IJdbc,
  database: string,
  table: string
): Promise<ImpalaColumnType[]> => {
  return (await jdbcClient.executeQueryAndRelease(
    `DESCRIBE ${escapeTableName(database)}.${escapeTableName(table)}`
  )) as ImpalaColumnType[];
};

const getDialectChildren = async (
  jdbcClient: IJdbc,
  item: NSDatabase.SearchableItem,
  parent: NSDatabase.SearchableItem
): Promise<MConnectionExplorer.IChildItem[]> => {
  switch (item.type) {
    case ContextValue.CONNECTION:
    case ContextValue.CONNECTED_CONNECTION:
      const databases = await getDatabases(jdbcClient);
      return (
        databases.map((database) => ({
          type: ContextValue.DATABASE,
          iconName: "database",
          childType: ContextValue.TABLE,
          catalog: database?.name,
          database: database?.name,
          label: database?.name,
          schema: undefined,
          isView: false,
        })) || []
      );
    case ContextValue.DATABASE:
    case ContextValue.SCHEMA:
      const tables = await getTables(jdbcClient, item.database);

      return (
        tables.map((table) => ({
          type: ContextValue.TABLE,
          iconName: "table",
          childType: ContextValue.COLUMN,
          database: item.database,
          catalog: parent.database,
          schema: item.database,
          label: table.name,
          table: table.name,
        })) || []
      );
    case ContextValue.VIEW:
    case ContextValue.MATERIALIZED_VIEW:
    case ContextValue.TABLE:
      const columns = await getColumns(jdbcClient, item.database, item.label);

      return (
        columns.map((column) => ({
          type: ContextValue.COLUMN,
          iconName: column?.primary_key === "true" ? "pk" : "column",
          childType: ContextValue.NO_CHILD,
          database: item.database,
          catalog: item.database,
          schema: item.schema,
          table: item.label,
          label: column.name,
          column: column.name,
          isNullable: column?.nullable,
          dataType: column.type,
          detail: `(${column.type}) ${column.comment}`,
        })) || []
      );
  }
  return [];
};

const searchDialectItem = async (
  jdbcClient: IJdbc,
  itemType: ContextValue,
  search: string,
  extraParams: any = {}
): Promise<NSDatabase.SearchableItem[]> => {
  console.log("searchDialectItem", itemType, search, extraParams);
  switch (itemType) {
    case ContextValue.DATABASE:
    case ContextValue.SCHEMA:
      const databases = await getDatabases(jdbcClient);
      return databases.map((database) => ({
        type: ContextValue.DATABASE,
        label: database.name,
        database: database.name,
        iconId: "database",
      })) as NSDatabase.SearchableItem[];
    case ContextValue.TABLE:
      if (!extraParams?.database) {
        return [];
      }

      const tables = await getTables(jdbcClient, extraParams.database);
      return tables.map((table) => ({
        type: ContextValue.TABLE,
        label: table.name,
        database: extraParams.database,
        iconId: "table",
      })) as NSDatabase.SearchableItem[];
  }

  return [];
};

export default {
  queries,
  getDialectChildren,
  searchDialectItem,
} as IDialect;

import {
  IDriverExtensionApi,
  IExtension,
  IExtensionPlugin,
} from "@sqltools/types";
import * as vscode from "vscode";
import { ExtensionContext } from "vscode";
import { displayName, name, publisher } from "../package.json";
import { DRIVER_ALIASES } from "./constants";

export async function activate(
  extContext: ExtensionContext
): Promise<IDriverExtensionApi> {
  const sqltools = vscode.extensions.getExtension<IExtension>("mtxr.sqltools");
  if (!sqltools) {
    throw new Error("SQLTools not installed");
  }
  await sqltools.activate();

  const api = sqltools.exports;

  const extensionId = `${publisher}.${name}`;
  const driver: IExtensionPlugin = {
    extensionId,
    name: `${displayName}`,
    type: "driver",
    async register(extension) {
      extension.resourcesMap().set(`driver/${DRIVER_ALIASES[0].value}/icons`, {
        active: extContext.asAbsolutePath("icons/active.png"),
        default: extContext.asAbsolutePath("icons/default.png"),
        inactive: extContext.asAbsolutePath("icons/inactive.png"),
      });
      DRIVER_ALIASES.forEach(({ value }) => {
        extension.resourcesMap().set(`driver/${value}/icons`, {
          active: extContext.asAbsolutePath(`icons/${value}/active.png`),
          default: extContext.asAbsolutePath(`icons/${value}/default.png`),
          inactive: extContext.asAbsolutePath(`icons/${value}/inactive.png`),
        });
        extension
          .resourcesMap()
          .set(`driver/${value}/extension-id`, extensionId);
        extension
          .resourcesMap()
          .set(
            `driver/${value}/connection-schema`,
            extContext.asAbsolutePath("connection.schema.json")
          );
        extension
          .resourcesMap()
          .set(
            `driver/${value}/ui-schema`,
            extContext.asAbsolutePath("ui.schema.json")
          );
      });
      await extension.client.sendRequest("ls/RegisterPlugin", {
        path: extContext.asAbsolutePath("out/src/ls/plugin.js"),
      });
    },
  };
  api.registerPlugin(driver);
  return {
    driverName: displayName,
    parseBeforeSaveConnection: ({ connInfo }) => {
      console.log("parseBeforeSaveConnection", connInfo);
      return connInfo;
    },
    parseBeforeEditConnection: ({ connInfo }) => {
      console.log("parseBeforeSaveConnection", connInfo);
      return connInfo;
    },
    driverAliases: DRIVER_ALIASES,
  };
}

export function deactivate() {}

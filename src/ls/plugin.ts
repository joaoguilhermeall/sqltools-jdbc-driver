import { DRIVER_ALIASES } from "../constants";
import driver from "./driver";
import { ILanguageServerPlugin } from "@sqltools/types";

const JDBCDriverPlugin: ILanguageServerPlugin = {
  register(server) {
    DRIVER_ALIASES.forEach(({ value }) => {
      server.getContext().drivers.set(value, driver as any);
    });
  },
};

export default JDBCDriverPlugin;

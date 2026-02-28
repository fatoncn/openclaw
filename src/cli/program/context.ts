import { resolveCommitHash } from "../../infra/git-commit.js"; // KOSBLING-PATCH
import { VERSION } from "../../version.js";
import { resolveCliChannelOptions } from "../channel-options.js";

export type ProgramContext = {
  programVersion: string;
  channelOptions: string[];
  messageChannelOptions: string;
  agentChannelOptions: string;
};

export function createProgramContext(): ProgramContext {
  const channelOptions = resolveCliChannelOptions();
  // KOSBLING-PATCH: include git commit hash in version output
  const commit = resolveCommitHash();
  return {
    programVersion: commit ? `${VERSION} (${commit})` : VERSION,
    channelOptions,
    messageChannelOptions: channelOptions.join("|"),
    agentChannelOptions: ["last", ...channelOptions].join("|"),
  };
}

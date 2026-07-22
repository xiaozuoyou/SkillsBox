import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateProgress = {
  downloaded: number;
  total: number | null;
};

/**
 * Query GitHub Releases (`latest.json`) for a newer app build.
 * Returns `null` when already up to date or no matching platform asset.
 */
export async function checkForAppUpdate(): Promise<Update | null> {
  return check();
}

/** Download, verify signature, install, then relaunch. */
export async function installAppUpdate(
  update: Update,
  onProgress?: (p: UpdateProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total: number | null = null;

  await update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
      downloaded = 0;
      onProgress?.({ downloaded, total });
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress?.({ downloaded, total });
    } else if (event.event === "Finished") {
      onProgress?.({ downloaded, total });
    }
  });

  await relaunch();
}

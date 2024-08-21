import { $ } from 'bun';
import path from 'path';
import { loadConfig, saveConfig } from '../utils';

export async function sync() {
  const config = await loadConfig();
  const appImagesDir = path.join(process.env.HOME!, '.appimages');
  const binDir = path.join(process.env.HOME!, '.local', 'bin');
  const desktopDir = path.join(process.env.HOME!, '.local', 'share', 'applications');

  const appImages = await $`ls ${appImagesDir}/*.AppImage`.lines();

  for (const appImage of appImages) {
    const appName = path.basename(appImage, '.AppImage');
    const command = appName.toLowerCase().replace(/\s/g, '-');

    const launcherPath = path.join(binDir, command);
    const desktopFile = path.join(desktopDir, `${appName}.desktop`);

    if (await $`test -f ${launcherPath}`.exitCode !== 0) continue;
    if (await $`test -f ${desktopFile}`.exitCode !== 0) continue;

    if (!config[command]) {
      config[command] = {
        app_name: appName,
        appimage_path: appImage,
        desktop_file: desktopFile,
        launcher_path: launcherPath,
        original_path: 'Unknown',
      };
      console.log(`Added ${appName} to config`);
    }
  }

  await saveConfig(config);
  console.log('Sync completed');
}
import { $ } from 'bun';
import { confirm, select } from '@clack/prompts';
import path from 'path';
import { loadConfig, saveConfig } from '../utils';

export async function remove() {
  const config = await loadConfig();

  const appCommand = await select({
    message: 'Select the AppImage to remove:',
    options: Object.entries(config).map(([command, info]) => ({
      value: command,
      label: `${command}: ${(info as any).app_name}`,
    })),
  });

  if (!appCommand) {
    console.log('No AppImage selected. Exiting.');
    return;
  }

  const appInfo = config[appCommand as string];

  // Remove desktop file
  const desktopFile = path.resolve(appInfo.desktop_file);
  await $`rm -f ${desktopFile}`;
  console.log(`Removed desktop file: ${desktopFile}`);

  // Remove launcher
  const launcherPath = path.resolve(appInfo.launcher_path);
  await $`rm -f ${launcherPath}`;
  console.log(`Removed launcher: ${launcherPath}`);

  // Move AppImage back to Downloads or delete it
  const appImagePath = path.resolve(appInfo.appimage_path);
  const shouldDelete = await confirm({
    message: 'Do you want to delete the AppImage file?',
  });

  if (shouldDelete) {
    await $`rm -f ${appImagePath}`;
    console.log(`Deleted AppImage: ${appImagePath}`);
  } else {
    const downloadsDir = path.join(process.env.HOME!, 'Downloads');
    await $`mv ${appImagePath} ${downloadsDir}`;
    console.log(`Moved AppImage back to: ${path.join(downloadsDir, path.basename(appImagePath))}`);
  }

  delete config[appCommand as string];
  await saveConfig(config);
  console.log(`Successfully removed AppImage installation for '${appCommand}'`);
}
import { $ } from 'bun';
import path from 'path';
import {
  loadConfig,
  saveConfig,
  getUserInput,
  selectAppImage,
  checkCommandExists,
  getUniqueCommand,
  createDesktopFile,
} from '../utils';

export async function add() {
  const config = await loadConfig();

  const appName = await getUserInput('Enter the name of the AppImage file (without extension)');
  const appImagePath = await selectAppImage(appName as string);

  if (!appImagePath) {
    console.log('No AppImage selected. Exiting.');
    return;
  }

  let appCommand = await getUserInput('Enter the command to launch the app');

  if (await checkCommandExists(appCommand as string)) {
    console.log(`Command '${appCommand}' is already in use by ${await $`which ${appCommand}`.text()}`);
    const choice = await getUserInput('Enter a new command or type \'force\' to replace it');
    
    if (choice === 'force') {
      console.log('Warning: Replacing existing command.');
    } else {
      appCommand = await getUniqueCommand(choice as string);
    }
  }

  const appImagesDir = path.join(process.env.HOME!, '.appimages');
  await $`mkdir -p ${appImagesDir}`;

  const newAppImagePath = path.join(appImagesDir, path.basename(appImagePath as string));
  await $`mv ${appImagePath} ${newAppImagePath}`;
  await $`chmod 755 ${newAppImagePath}`;

  await createDesktopFile(appName as string, newAppImagePath);

  const binDir = path.join(process.env.HOME!, '.local', 'bin');
  await $`mkdir -p ${binDir}`;

  const launcherPath = path.join(binDir, appCommand as string);
  await $`echo '#!/bin/bash\nnohup ${newAppImagePath} "$@" >/dev/null 2>&1 &' > ${launcherPath}`;
  await $`chmod 755 ${launcherPath}`;

  config[appCommand as string] = {
    app_name: appName,
    appimage_path: newAppImagePath,
    desktop_file: path.join(process.env.HOME!, '.local', 'share', 'applications', `${appName}.desktop`),
    launcher_path: launcherPath,
    original_path: appImagePath,
  };

  await saveConfig(config);

  console.log('AppImage installed successfully!');
  console.log(`You can now launch ${appName} by running '${appCommand}' or from your applications menu.`);
}
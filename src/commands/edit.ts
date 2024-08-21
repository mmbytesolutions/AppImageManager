import { $ } from 'bun';
import { select, text } from '@clack/prompts';
import path from 'path';
import { loadConfig, saveConfig } from '../utils';

export async function edit() {
  const config = await loadConfig();

  const oldCommand = await select({
    message: 'Select the AppImage command to edit:',
    options: Object.entries(config).map(([command, info]) => ({
      value: command,
      label: `${command}: ${(info as any).app_name}`,
    })),
  });

  if (!oldCommand) {
    console.log('No AppImage selected. Exiting.');
    return;
  }

  const newCommand = await text({
    message: 'Enter the new command:',
    defaultValue: oldCommand as string,
  });

  if (!newCommand || newCommand === oldCommand) {
    console.log('No change in command. Exiting.');
    return;
  }

  const appInfo = config[oldCommand as string];

  // Rename launcher
  const oldLauncherPath = path.resolve(appInfo.launcher_path);
  const newLauncherPath = path.join(path.dirname(oldLauncherPath), newCommand as string);
  await $`mv ${oldLauncherPath} ${newLauncherPath}`;

  // Update launcher content
  await $`echo '#!/bin/bash\nexec ${appInfo.appimage_path} "$@"' > ${newLauncherPath}`;
  await $`chmod 755 ${newLauncherPath}`;

  // Update config
  config[newCommand as string] = {
    ...appInfo,
    launcher_path: newLauncherPath,
  };
  delete config[oldCommand as string];
  await saveConfig(config);

  console.log(`Successfully renamed command from '${oldCommand}' to '${newCommand}'`);
}
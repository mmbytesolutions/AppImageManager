import { confirm } from '@clack/prompts';
import { loadConfig } from '../utils';

export async function list() {
  const config = await loadConfig();

  if (Object.keys(config).length === 0) {
    console.log('No AppImage installations found');
    return;
  }

  const verbose = await confirm({
    message: 'Do you want to see detailed information?',
  });

  if (verbose) {
    for (const [command, appInfo] of Object.entries(config)) {
      console.log(`${command}:`, appInfo);
    }
  } else {
    for (const [command, appInfo] of Object.entries(config)) {
      console.log(`${command}: ${(appInfo as any).app_name}`);
    }
  }

  console.log('List of all installed AppImages');
}
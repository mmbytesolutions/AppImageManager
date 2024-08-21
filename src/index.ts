#!/usr/bin/env bun
import { intro, outro, select } from '@clack/prompts';
import { add } from './commands/add';
import { remove } from './commands/remove';
import { edit } from './commands/edit';
import { sync } from './commands/sync';
import { list } from './commands/list';

async function main() {
  intro('AppImage Installer');

  const command = await select({
    message: 'What would you like to do?',
    options: [
      { value: 'add', label: 'Add a new AppImage' },
      { value: 'remove', label: 'Remove an installed AppImage' },
      { value: 'edit', label: 'Edit an installed AppImage\'s command' },
      { value: 'sync', label: 'Sync existing AppImages' },
      { value: 'list', label: 'List all installed AppImages' },
    ],
  });

  switch (command) {
    case 'add':
      await add();
      break;
    case 'remove':
      await remove();
      break;
    case 'edit':
      await edit();
      break;
    case 'sync':
      await sync();
      break;
    case 'list':
      await list();
      break;
  }

  outro('Thank you for using AppImage Installer!');
}

main().catch(console.error);
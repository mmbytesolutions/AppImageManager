import { $ } from "bun";
import { text, confirm, select } from "@clack/prompts";
import fs from "fs/promises";
import path from "path";

const CONFIG_FILE = path.join(
  process.env.HOME!,
  ".appimage_installer_config.json"
);

export async function loadConfig() {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

export async function saveConfig(config: object) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function getUserInput(prompt: string, defaultValue: string = "") {
  return text({
    message: prompt,
    defaultValue,
  });
}

export async function selectAppImage(appName: string) {
  const downloadsDir = path.join(process.env.HOME!, "Downloads");
  const appImages = await $`ls ${downloadsDir}/${appName}*.AppImage`.lines();

  if (appImages.length === 0) {
    console.log(
      `No AppImage files matching '${appName}*.AppImage' found in Downloads folder.`
    );
    return null;
  }

  if (appImages.length === 1) {
    const confirmed = await confirm({
      message: `Is this the app you want to add? ${appImages[0]}`,
    });
    return confirmed ? path.join(downloadsDir, appImages[0]) : null;
  }

  return select({
    message: "Multiple AppImage files found. Please select one:",
    options: appImages.map((app, index) => ({
      value: path.join(downloadsDir, app),
      label: app,
    })),
  });
}

export async function checkCommandExists(command: string) {
  const result = await $`which ${command}`.quiet();
  return result.exitCode === 0;
}

export async function getUniqueCommand(baseCommand: string) {
  if (!(await checkCommandExists(baseCommand))) {
    return baseCommand;
  }

  let counter = 1;
  while (await checkCommandExists(`${baseCommand}${counter}`)) {
    counter++;
  }
  return `${baseCommand}${counter}`;
}

export async function createDesktopFile(
  appName: string,
  execPath: string,
  iconPath?: string
) {
  const desktopDir = path.join(
    process.env.HOME!,
    ".local",
    "share",
    "applications"
  );
  await $`mkdir -p ${desktopDir}`;

  const desktopFile = path.join(desktopDir, `${appName}.desktop`);
  const desktopEntry = `
[Desktop Entry]
Name=${appName}
Exec=${execPath}
Icon=${iconPath || "application-x-executable"}
Type=Application
Categories=Utility;
`;

  await fs.writeFile(desktopFile, desktopEntry);
  console.log(`Desktop file created: ${desktopFile}`);
}

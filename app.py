#!/usr/bin/env python3

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Optional

CONFIG_FILE = Path.home() / ".appimage_installer_config.json"


def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_user_input(prompt: str, default: str = "") -> str:
    if default:
        prompt = f"{prompt} [{default}]: "
    else:
        prompt = f"{prompt}: "
    return input(prompt) or default


def sync_appimages():
    config = load_config()
    appimages_dir = Path.home() / ".appimages"
    bin_dir = Path.home() / ".local" / "bin"
    desktop_dir = Path.home() / ".local" / "share" / "applications"

    # Scan .appimages directory
    for appimage in appimages_dir.glob("*.AppImage"):
        app_name = appimage.stem
        command = app_name.lower().replace(" ", "-")

        # Check if launcher exists
        launcher_path = bin_dir / command
        if not launcher_path.exists():
            continue

        # Check if desktop file exists
        desktop_file = desktop_dir / f"{app_name}.desktop"
        if not desktop_file.exists():
            continue

        # Add to config if not already present
        if command not in config:
            config[command] = {
                "app_name": app_name,
                "appimage_path": str(appimage),
                "desktop_file": str(desktop_file),
                "launcher_path": str(launcher_path),
                "original_path": "Unknown",
            }
            print(f"Added {app_name} to config")

    save_config(config)
    print("Sync completed")


def select_appimage(app_name: str) -> Optional[str]:
    downloads_dir = Path.home() / "Downloads"
    app_images = list(downloads_dir.glob(f"{app_name}*.AppImage"))

    if not app_images:
        print(
            f"No AppImage files matching '{app_name}*.AppImage' found in Downloads folder."
        )
        return None

    if len(app_images) == 1:
        confirm = get_user_input(
            f"Is this the app you want to add? {app_images[0].name} (Y/n)", "Y"
        )
        return str(app_images[0]) if confirm.lower() != "n" else None

    print("Multiple AppImage files found. Please select one:")
    for i, app in enumerate(app_images, 1):
        print(f"{i}. {app.name}")

    while True:
        try:
            choice = int(get_user_input("Enter the number of your choice"))
            if 1 <= choice <= len(app_images):
                return str(app_images[choice - 1])
            print("Invalid choice. Please try again.")
        except ValueError:
            print("Please enter a valid number.")


def check_command_exists(command: str) -> bool:
    return shutil.which(command) is not None


def get_unique_command(base_command: str) -> str:
    if not check_command_exists(base_command):
        return base_command

    counter = 1
    while check_command_exists(f"{base_command}{counter}"):
        counter += 1
    return f"{base_command}{counter}"


def create_desktop_file(
    app_name: str, exec_path: str, icon_path: Optional[str] = None
) -> None:
    desktop_dir = Path.home() / ".local" / "share" / "applications"
    desktop_dir.mkdir(parents=True, exist_ok=True)

    desktop_file = desktop_dir / f"{app_name}.desktop"
    with desktop_file.open("w") as f:
        f.write(
            f"""[Desktop Entry]
Name={app_name}
Exec={exec_path}
Icon={icon_path or 'application-x-executable'}
Type=Application
Categories=Utility;
"""
        )
    print(f"Desktop file created: {desktop_file}")


def add_appimage(args):
    config = load_config()

    if not args.app_name:
        args.app_name = get_user_input(
            "Enter the name of the AppImage file (without extension)"
        )

    appimage_path = select_appimage(args.app_name)
    if not appimage_path:
        print("No AppImage selected. Exiting.")
        sys.exit(1)

    if not args.app_command:
        args.app_command = get_user_input("Enter the command to launch the app")

    if check_command_exists(args.app_command):
        print(
            f"Command '{args.app_command}' is already in use by {shutil.which(args.app_command)}"
        )
        choice = get_user_input("Enter a new command or type 'force' to replace it")
        if choice.lower() == "force":
            print("Warning: Replacing existing command.")
        else:
            args.app_command = get_unique_command(choice)

    appimages_dir = Path.home() / ".appimages"
    appimages_dir.mkdir(exist_ok=True)

    new_appimage_path = appimages_dir / Path(appimage_path).name
    shutil.move(appimage_path, new_appimage_path)
    new_appimage_path.chmod(0o755)

    desktop_dir = Path.home() / ".local" / "share" / "applications"
    create_desktop_file(args.app_name, str(new_appimage_path), args.icon)

    bin_dir = Path.home() / ".local" / "bin"
    bin_dir.mkdir(parents=True, exist_ok=True)

    launcher_path = bin_dir / args.app_command
    with launcher_path.open("w") as f:
        f.write(
            f"""#!/bin/bash
nohup {new_appimage_path} "$@" >/dev/null 2>&1 &
"""
        )
    launcher_path.chmod(0o755)

    config[args.app_command] = {
        "app_name": args.app_name,
        "appimage_path": str(new_appimage_path),
        "desktop_file": str(desktop_dir / f"{args.app_name}.desktop"),
        "launcher_path": str(launcher_path),
        "original_path": appimage_path,
    }
    save_config(config)

    print("AppImage installed successfully!")
    print(
        f"You can now launch {args.app_name} by running '{args.app_command}' or from your applications menu."
    )


def remove_appimage(args):
    config = load_config()
    if args.app_command not in config:
        print(f"No AppImage installation found for command '{args.app_command}'")
        return

    app_info = config[args.app_command]

    # Remove desktop file
    desktop_file = Path(app_info["desktop_file"])
    if desktop_file.exists():
        desktop_file.unlink()
        print(f"Removed desktop file: {desktop_file}")

    # Remove launcher
    launcher_path = Path(app_info["launcher_path"])
    if launcher_path.exists():
        launcher_path.unlink()
        print(f"Removed launcher: {launcher_path}")

    # Move AppImage back to Downloads or delete it
    appimage_path = Path(app_info["appimage_path"])
    if appimage_path.exists():
        if args.delete:
            appimage_path.unlink()
            print(f"Deleted AppImage: {appimage_path}")
        else:
            downloads_dir = Path.home() / "Downloads"
            shutil.move(str(appimage_path), downloads_dir)
            print(f"Moved AppImage back to: {downloads_dir / appimage_path.name}")

    del config[args.app_command]
    save_config(config)
    print(f"Successfully removed AppImage installation for '{args.app_command}'")


def list_appimages(args):
    config = load_config()

    if not config:
        print("No AppImage installations found")
        return

    # if verbose flag print all details
    if args.verbose:
        for command, app_info in config.items():
            print(f"{command}: {app_info}")
        return
    else:
        for command, app_info in config.items():
            print(f"{command}: {app_info['app_name']}")

    print("List of all installed AppImages")


def edit_command(args):
    config = load_config()
    if args.old_command not in config:
        print(f"No AppImage installation found for command '{args.old_command}'")
        return

    app_info = config[args.old_command]

    # Rename launcher
    old_launcher_path = Path(app_info["launcher_path"])
    new_launcher_path = old_launcher_path.parent / args.new_command
    old_launcher_path.rename(new_launcher_path)

    # Update launcher content
    with new_launcher_path.open("w") as f:
        f.write(
            f"""#!/bin/bash
                exec {app_info["appimage_path"]} "$@"
            """
        )
    new_launcher_path.chmod(0o755)

    # Update config
    config[args.new_command] = app_info
    config[args.new_command]["launcher_path"] = str(new_launcher_path)
    del config[args.old_command]
    save_config(config)

    print(
        f"Successfully renamed command from '{args.old_command}' to '{args.new_command}'"
    )


def main():
    parser = argparse.ArgumentParser(description="Manage AppImage installations")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Add command
    add_parser = subparsers.add_parser("add", help="Add a new AppImage")
    add_parser.add_argument(
        "app_name", nargs="?", help="Name of the AppImage file (without extension)"
    )
    add_parser.add_argument("app_command", nargs="?", help="Command to launch the app")
    add_parser.add_argument("-i", "--icon", help="Path to the icon file")

    # Remove command
    rm_parser = subparsers.add_parser("rm", help="Remove an installed AppImage")
    rm_parser.add_argument("app_command", help="Command of the app to remove")
    rm_parser.add_argument(
        "-d",
        "--delete",
        action="store_true",
        help="Delete the AppImage instead of moving it back to Downloads",
    )

    # Edit command
    edit_parser = subparsers.add_parser(
        "edit", help="Edit an installed AppImage's command"
    )
    edit_parser.add_argument("old_command", help="Current command of the app")
    edit_parser.add_argument("new_command", help="New command for the app")

    # Sync command
    subparsers.add_parser("sync", help="Sync existing AppImages to the config file")

    # List command
    list_parser = subparsers.add_parser("list", help="List all installed AppImages")
    list_parser.add_argument(
        "-v", "--verbose", action="store_true", help="Show details"
    )

    args = parser.parse_args()

    if args.command == "add":
        add_appimage(args)
    elif args.command == "rm":
        remove_appimage(args)
    elif args.command == "edit":
        edit_command(args)
    elif args.command == "sync":
        sync_appimages()
    elif args.command == "list":
        list_appimages(args)


if __name__ == "__main__":
    main()

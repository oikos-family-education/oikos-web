# Installing Oikos on your computer

Oikos runs on your own computer. Your family's information stays on that computer and is not sent anywhere. Pick your computer type below.

Before you start, you will need the installer file I sent you:

- **Windows:** a file called `Oikos Setup 0.1.0.exe` (the number may be different).
- **Mac:** a file ending in `.dmg`. There are two kinds, and you need the right one:
  - `Oikos-0.1.0-arm64.dmg` for newer Macs (Apple M1, M2, M3 and later).
  - `Oikos-0.1.0-x64.dmg` for older Macs with an Intel chip.
  - Not sure? Click the Apple menu, then **About This Mac**. If it says "Chip: Apple M...", use `arm64`. If it says "Processor: Intel...", use `x64`.

Oikos is not sold through the app stores, so Windows and macOS will show a warning the first time. That is expected, and the steps below get you past it.

## Windows

1. Double-click `Oikos Setup 0.1.0.exe`.
2. If you see 'Windows protected your PC', click **More info → Run anyway**.

   ![Windows warning](images/windows-smartscreen.png)

   <!-- TODO: add a screenshot of the Windows "protected your PC" window with "More info" and "Run anyway" -->

3. Wait for the install to finish. Oikos opens by itself.

**If Windows says "Smart App Control blocked" the app:** some Windows 11 computers block apps like this one completely, with no "Run anyway" button. Please contact me and I will help you from there. You do not need to change any Windows settings.

## Mac

1. Open the DMG and drag Oikos to Applications. Open it; when macOS blocks it, go to **System Settings → Privacy & Security → Open Anyway**. If macOS says the app 'is damaged', run `xattr -cr /Applications/Oikos.app` in Terminal, or call me.

   ![macOS warning](images/macos-gatekeeper.png)

   <!-- TODO: add a screenshot of System Settings > Privacy & Security with the "Open Anyway" button -->

2. After you click **Open Anyway**, macOS may ask for your password and then ask once more whether to open Oikos. Click **Open**.

You only need to do this once. After that, Oikos opens like any other app.

## The first time Oikos opens

- A short loading screen appears while Oikos sets up its local database. This takes a little longer the first time and is quicker afterwards.
- Then you see the welcome page. As a parent, choose one:
  - **Create your family** to start fresh and register as a parent.
  - **Restore from backup** if you already have a `.oikos` backup file.

## Your data and backups

- Everything is stored only on this computer. If the computer is lost or the disk fails, the data is gone unless you have a backup.
- To save a backup, open **Settings → Backup** and click **Save backup**. Oikos asks where to put the file. Keep a copy somewhere safe, such as a USB drive or a cloud folder you trust.
- To move to a new computer, or after a reinstall, install Oikos, choose **Restore from backup** on the welcome page and pick your `.oikos` file. Oikos then asks you to set a password.

## Installing an update

When I send you a newer version, install it over the one you have. You don't need to uninstall anything first.

1. Close Oikos.
2. **Windows:** run the new `Oikos Setup` file, the same way as the first time. **Mac:** open the new DMG and drag Oikos to Applications again; when macOS asks, choose **Replace**.
3. Open Oikos as usual.

Your data stays where it is. Before the update changes anything, Oikos automatically makes a safety copy of your data on this computer, so the first start after an update can take a little longer.

## Something went wrong?

Send me a message or call me. If you can, tell me what you saw on the screen (a photo of it helps a lot).

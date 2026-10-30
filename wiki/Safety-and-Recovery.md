# Safety & Recovery

[Home](Home) · [How It Works](How-It-Works) · [Configuration Reference](Configuration-Reference)

Plugin Switch changes boot-persistent `.plg` manifests and may ask **trusted adapters** to stop privileged services. These operations are potentially disruptive. A toggle is not a guarantee that every side effect of another plugin has been reversed.

## Protection before a toggle

Before disabling a plugin, the controller checks:

- Identifier and path validity; explicitly protected internal identifiers.
- Optional administrator protection and dependency policy in `safety.json`.
- Whether a previous operation left an unresolved transaction journal.
- Whether the target manifest and its Unraid registration symlink are in the expected state.
- Whether a trusted adapter exists and its status can be determined.

The controller uses an exclusive operation lock under `/run/plugin-switch/` to serialize state-changing operations. It does not infer dependency relationships from a scanner hit; protection/dependency rules are explicit and manually maintained.

## Operation journal and rollback

In-progress operations are recorded under:

```text
/boot/config/plugins/plugin.switch/transactions/<plugin>.plg.json
```

Journal phases are persisted as the operation proceeds. A completed outcome enters `/boot/config/plugins/plugin.switch/history.json` (bounded to recent entries). On failure, Plugin Switch attempts to return the manifest, registration and runtime to their original state. **Rollback is best effort and may fail** when an adapter is buggy, a file operation fails, or a service has already changed shared system state.

If Plugin Switch cannot verify recovery, it retains the pending journal and blocks subsequent toggles on that plugin. A locked control or **Recovery required** result is not permission to delete the journal blindly.

## The Recovery button

The **Recovery** modal displays pending transactions and recent results. **Restore next boot** is an emergency manifest-recovery action. It tries to move parked `.plg` definitions back to `/boot/config/plugins/` so Unraid can process them on a *future reboot*. It also handles clearly identifiable interrupted operations.

It **does not**:

- Restart services or execute arbitrary third-party plugin scripts immediately.
- Automatically reboot the server.
- Automatically resolve ambiguous file conflicts or corrupt manifests.
- Promise that a plugin's previous runtime configuration is intact.

Review the operation result; some files may be reported as skipped and need manual review. Make a flash backup before performing recovery if possible, and plan the reboot when it is safe for workloads.

## Manual recovery when the WebGUI is unavailable

Access the physical console or SSH with appropriate credentials. **Inspect before changing anything**:

```bash
# Check which definitions are parked.
find /boot/config/plugins/plugin.switch/disabled -maxdepth 1 -type f -name '*.plg' -print

# Check which definitions are currently in Unraid's startup scan.
find /boot/config/plugins -maxdepth 1 -type f -name '*.plg' -print

# Inspect pending operations (do not delete journals to silence errors).
ls -l /boot/config/plugins/plugin.switch/transactions/
```

For a **single known-safe parked plugin** that should be restored at next boot, first verify there is no same-name file or symlink at the target path. Then restore the manifest **without running it**:

```bash
# Replace example.plg with the EXACT inspected filename.
# Execute only if /boot/config/plugins/example.plg does not already exist.
mv /boot/config/plugins/plugin.switch/disabled/example.plg \
   /boot/config/plugins/example.plg
```

This restores boot intent only. It does not reinstate the runtime now. Confirm no other conflicting plugin state exists, and reboot when appropriate. If the plugin has a pending journal, unusual symlinks, or conflicting files, **stop here and investigate**; do not force a move or erase tracking files.

## Failure scenarios

| Symptom | Safe next action |
|---|---|
| Adapter `status` fails | Do not toggle; inspect adapter logs and service state |
| Disable failed but service still running | Review transaction and report; avoid repeated retries |
| Manifest parked, but plugin still appears active | Some runtime hooks may still be installed; don't assume removal is complete |
| Enable after reboot fails | Verify the plugin installer output, parked manifest and journal; manual recovery may be necessary |
| `Recovery required` | Read pending journal; use the Recovery dialog or inspect conflicting paths |
| Unraid is unreachable after adapter use | Use local/console access; revert the affected plugin in accordance with its own documented recovery steps |

## Protect important plugins

Set explicit rules in [Configuration Reference](Configuration-Reference). Especially consider access-critical network/security plugins and storage/driver integrations. An unknown plugin should remain locked rather than receive a guessed adapter.

## Before uninstalling Plugin Switch

**Restore all parked manifests you intend to retain before uninstalling Plugin Switch.** Its uninstall hook does *not* automatically unpark them. Persistent settings and recovery directories are deliberately retained. If you delete those directories, you could remove the only copy of a parked plugin manifest.

If the server is production-critical, prefer performing live-control testing in a disposable Unraid environment and keep a verified flash backup.

**Plugin Switch**

Manage plugins from Unraid's existing **Plugins** tab with an Enabled toggle and automatic read-only compatibility discovery. Supported plugins can be safely stopped and restarted without uninstalling them; settings are preserved. Plugins without a verified live-control adapter remain installed, with their toggle locked and an explanation shown.

**Update channel:** `__PLUGIN_SWITCH_BRANCH__`. Updates follow the same GitHub branch used for installation.

**Detection:** Safe live controls require verified profiles or trusted local adapters. Potential services are marked for review. The Plugins tab offers manual rescans, per-plugin evidence and a local export.

**Recovery:** Pending operations are journaled; recovery can restore manifests for next boot without executing plugin scripts. Live controls remain restricted to verified adapters.

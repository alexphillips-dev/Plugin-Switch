import unittest
import os
import hashlib
import xml.etree.ElementTree as ET
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build', ROOT / 'tools/build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

class BuildTests(unittest.TestCase):
    def test_manifest_matches_sources(self):
        branch = os.environ.get("PLUGIN_SWITCH_BRANCH", "dev")
        self.assertEqual((ROOT / 'plugin.switch.plg').read_text(), build.build(branch))
    def test_valid_xml(self):
        root = ET.fromstring(build.build())
        self.assertEqual(root.tag, 'PLUGIN')
        self.assertEqual(len(root.findall('FILE')), 12)
    def test_inline_file_checksums_for_unraid_updates(self):
        root = ET.fromstring(build.build("dev"))
        named = [entry for entry in root.findall("FILE") if entry.attrib.get("Name")]
        self.assertGreater(len(named), 0)
        for entry in named:
            with self.subTest(file=entry.attrib["Name"]):
                inline = entry.findtext("INLINE")
                declared = entry.findtext("SHA256")
                self.assertIsNotNone(inline)
                self.assertRegex(declared or "", r"^[0-9a-f]{64}$")
                # Unraid writes trim(INLINE).PHP_EOL before checking the
                # checksum on a later install/update.
                expected = hashlib.sha256((inline.strip() + "\n").encode("utf-8")).hexdigest()
                self.assertEqual(declared, expected)

    def test_unraid_version_policy(self):
        self.assertEqual(build.VERSION, "2026.10.29.10")
        build.validate_version(build.VERSION)
        self.assertIn(f'<!ENTITY version "{build.VERSION}">', build.build())
        for invalid in ("2026.10.29-dev1", "2026.13.29.1", "2026.02.30.1",
                        "2026.10.29", "2026.10.29.0"):
            with self.subTest(version=invalid):
                with self.assertRaises(ValueError):
                    build.validate_version(invalid)

    def test_branch_pins_updates_and_readme_description(self):
        for branch in ("dev", "main"):
            with self.subTest(branch=branch):
                root = ET.fromstring(build.build(branch))
                self.assertEqual(root.attrib["name"], "plugin.switch")
                self.assertEqual(root.attrib["author"], "alexphillips-dev")
                self.assertEqual(root.attrib["pluginURL"],
                    f"https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/{branch}/plugin.switch.plg")
                readmes = [element for element in root.findall("FILE")
                           if element.attrib.get("Name", "").endswith("/README.md")]
                self.assertEqual(len(readmes), 1)
                readme = readmes[0].findtext("INLINE")
                self.assertIn("**Plugin Switch**", readme)
                self.assertIn("Manage plugins", readme)
                self.assertIn(f"**Update channel:** `{branch}`", readme)
                self.assertNotIn("__PLUGIN_SWITCH_BRANCH__", readme)
        with self.assertRaises(ValueError):
            build.build("feature/test")

    def test_frontend_reflects_registration_not_runtime_probe(self):
        script = (ROOT / "src/switch.js").read_text()
        self.assertIn("p.enabled ? 'true' : 'false'", script)
        self.assertIn("switchButton.disabled = !p.supported;", script)
        self.assertIn("role=\"switch\"", script)
        self.assertIn("attachShadow({mode:'open'})", script)

    def test_controller_protects_critical_plugins(self):
        source = (ROOT / 'src/Controller.php').read_text()
        self.assertIn("plugin.switch.plg", source)
        self.assertIn("unRAIDServer.plg", source)
        self.assertIn("flock($lock, LOCK_EX)", source)

if __name__ == '__main__':
    unittest.main()

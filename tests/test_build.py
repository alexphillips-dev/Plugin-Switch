import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build', ROOT / 'tools/build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

class BuildTests(unittest.TestCase):
    def test_manifest_matches_sources(self):
        self.assertEqual((ROOT / 'plugin.switch.plg').read_text(), build.build())
    def test_valid_xml(self):
        root = ET.fromstring(build.build())
        self.assertEqual(root.tag, 'PLUGIN')
        self.assertEqual(len(root.findall('FILE')), 6)
    def test_unraid_version_policy(self):
        self.assertEqual(build.VERSION, "2026.10.29.1")
        build.validate_version(build.VERSION)
        self.assertIn(f'<!ENTITY version "{build.VERSION}">', build.build())
        for invalid in ("2026.10.29-dev1", "2026.13.29.1", "2026.02.30.1",
                        "2026.10.29", "2026.10.29.0"):
            with self.subTest(version=invalid):
                with self.assertRaises(ValueError):
                    build.validate_version(invalid)

    def test_frontend_reflects_registration_not_runtime_probe(self):
        script = (ROOT / "src/switch.js").read_text()
        self.assertIn("const checked = p.enabled ? ' checked' : '';", script)
        self.assertIn("toggle.checked = p.enabled;", script)
        self.assertIn("case 'no-adapter': return 'No live control';", script)

    def test_controller_protects_critical_plugins(self):
        source = (ROOT / 'src/Controller.php').read_text()
        self.assertIn("plugin.switch.plg", source)
        self.assertIn("unRAIDServer.plg", source)
        self.assertIn("flock($lock, LOCK_EX)", source)

if __name__ == '__main__':
    unittest.main()

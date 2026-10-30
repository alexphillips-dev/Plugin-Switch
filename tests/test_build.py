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
    def test_controller_protects_critical_plugins(self):
        source = (ROOT / 'src/Controller.php').read_text()
        self.assertIn("plugin.switch.plg", source)
        self.assertIn("unRAIDServer.plg", source)
        self.assertIn("flock($lock, LOCK_EX)", source)

if __name__ == '__main__':
    unittest.main()

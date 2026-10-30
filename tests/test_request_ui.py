import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RequestAndInterfaceTests(unittest.TestCase):
    def test_rescan_uses_safe_get(self):
        frontend = (ROOT / 'src/switch.js').read_text()
        backend = (ROOT / 'src/api.php').read_text()
        self.assertIn("api+'?rescan=1'", frontend)
        self.assertIn("($_GET['rescan'] ?? '') === '1'", backend)
        self.assertIn('$manager->all($force)', backend)
        self.assertNotIn("action:'rescan'", frontend)
        self.assertNotIn("parse_ini_file('/var/local/emhttp/var.ini'", backend)
        self.assertIn("Unraid's webGUI auto_prepend", backend)
        self.assertIn("method:'POST'", frontend)
        self.assertIn('csrf_token:token', frontend)

    def test_enabled_column_stays_single_line(self):
        script = (ROOT / 'src/switch.js').read_text()
        self.assertIn("class=\"ps-actions\"", script)
        self.assertIn('class=\"ps-info\"', script)
        self.assertIn('ps-details', script)
        self.assertIn('fa-lock', script)
        self.assertNotIn('ps-state', script)
        self.assertNotIn('<summary>Why?</summary>', script)

    @unittest.skipUnless(shutil.which('php'), 'PHP CLI is needed for endpoint checks')
    def test_get_rescan_without_csrf(self):
        code = '''$_SERVER["REQUEST_METHOD"]="GET";
                   $_GET["rescan"]="1";
                   include "src/api.php";'''
        p = subprocess.run(['php', '-r', code], cwd=ROOT, text=True,
                           capture_output=True, timeout=20, check=True)
        parsed = json.loads(p.stdout)
        self.assertIsInstance(parsed['plugins'], list)

    @unittest.skipUnless(shutil.which('php'), 'PHP CLI is needed for endpoint checks')
    def test_post_after_native_middleware_consumes_csrf(self):
        # Local CLI does not simulate Unraid's authentication middleware:
        # it verifies only that our handler doesn't repeat CSRF validation.
        code = '''$_SERVER["REQUEST_METHOD"]="POST";
                   $_POST=["action"=>"unknown"];
                   include "src/api.php";'''
        p = subprocess.run(['php', '-r', code], cwd=ROOT, text=True,
                           capture_output=True, timeout=20, check=True)
        parsed = json.loads(p.stdout)
        self.assertEqual(parsed['error'], 'Unknown operation')
        self.assertNotIn('csrf', parsed['error'].lower())


if __name__ == '__main__':
    unittest.main()

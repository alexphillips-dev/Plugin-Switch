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

    def test_controls_are_isolated_and_modal_is_scrollable(self):
        script = (ROOT / 'src/switch.js').read_text()
        self.assertIn("attachShadow({mode:'open'})", script)
        self.assertIn('role=\"switch\"', script)
        self.assertIn('aria-checked="false"', script)
        self.assertIn('aria-modal="true"', script)
        self.assertIn('class="overlay"', script)
        self.assertIn('class="scroll"', script)
        self.assertIn('overflow-y:auto!important', script)
        self.assertIn('grid-template-columns:145px minmax(0,1fr)', script)
        self.assertIn('@media(max-width:540px)', script)
        self.assertIn("Escape", script)
        self.assertNotIn('type="checkbox"', script)
        self.assertNotIn('<summary>Why?</summary>', script)
        self.assertNotIn('ps-evidence-row', script)

    def test_toolbar_actions_stay_right_aligned(self):
        script = (ROOT / 'src/switch.js').read_text()
        self.assertIn("bar.style.setProperty('justify-content','flex-end','important')", script)
        self.assertIn("actions.style.setProperty('margin-left','auto','important')", script)
        self.assertIn("actions.style.setProperty('justify-content','flex-end','important')", script)
        self.assertIn("id=\"ps-rescan\"", script)
        self.assertIn("id=\"ps-export\"", script)

    def test_toggle_group_uses_fixed_left_inset(self):
        script = (ROOT / 'src/switch.js').read_text()
        self.assertIn("cell.style.setProperty('position','relative','important')", script)
        self.assertIn("cell.style.setProperty('padding-left','0','important')", script)
        self.assertIn("cell.style.setProperty('padding-right','0','important')", script)
        self.assertIn("cell.style.setProperty('text-align','left','important')", script)
        self.assertIn("host.style.setProperty('position','absolute','important')", script)
        self.assertIn("host.style.setProperty('left','12px','important')", script)
        self.assertIn("host.style.setProperty('top','50%','important')", script)
        self.assertIn("host.style.setProperty('transform','translateY(-50%)','important')", script)
        self.assertIn('.actions{display:flex;align-items:center;justify-content:flex-start;', script)
        self.assertIn(':host{display:block;width:68px;', script)
        self.assertNotIn("host.style.setProperty('left','50%','important')", script)

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

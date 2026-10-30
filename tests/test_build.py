import hashlib
import importlib.util
import io
import os
from pathlib import Path
import tarfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('build', ROOT / 'tools/build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

class BuildTests(unittest.TestCase):
    def test_version_changelog(self):
        self.assertEqual(build.VERSION, '2026.10.29.11')
        build.validate_version(build.VERSION)
        build.validate_release_history()
        self.assertEqual(build.release_history()[0], build.VERSION)
        self.assertNotIn('2026.10.29.90', build.release_history())
        self.assertEqual(build.next_version('2026.10.29.11', '2026-10-29'), '2026.10.29.12')
        self.assertEqual(build.next_version('2026.10.29.11', '2026-10-30'), '2026.10.30.01')
        for bad in ('2026.10.29-dev1','2026.10.29.1','2026.13.29.01',
                    '2026.02.30.01','2026.10.29','2026.10.29.00'):
            with self.subTest(version=bad):
                with self.assertRaises(ValueError):
                    build.validate_version(bad)

    def test_repo_readme_is_short(self):
        readme = (ROOT / 'README.md').read_text(encoding='utf-8')
        self.assertLess(len(readme.split()), 550)
        self.assertIn('[Changelog](CHANGELOG.md)', readme)
        self.assertIn('GitHub Wiki', readme)

    def test_branch_specific_manifests_and_archives(self):
        for branch in ('dev','main'):
            with self.subTest(branch=branch):
                archive = build.build_archive(branch)
                manifest = build.build(branch, archive)
                root = ET.fromstring(manifest)
                self.assertEqual(root.attrib['name'], 'plugin.switch')
                self.assertEqual(root.attrib['author'], 'alexphillips-dev')
                self.assertEqual(root.attrib['version'], build.VERSION)
                self.assertEqual(root.attrib['pluginURL'],
                    f'https://raw.githubusercontent.com/alexphillips-dev/Plugin-Switch/{branch}/plugin.switch.plg')
                self.assertEqual(len(root.findall('FILE')), 3)
                package = next(x for x in root.findall('FILE') if x.attrib.get('Name','').endswith('.txz'))
                self.assertEqual(package.attrib['Run'], 'upgradepkg --install-new')
                self.assertEqual(package.findtext('SHA256'), hashlib.sha256(archive).hexdigest())
                self.assertEqual(package.findtext('MD5'), hashlib.md5(archive).hexdigest())
                self.assertIn(f'/{branch}/archive/', package.findtext('URL'))
                self.assertIn(f'plugin.switch-{build.VERSION}.txz', package.findtext('URL'))
                self.assertEqual(archive[:6], bytes.fromhex('fd377a585a00'))
                with tarfile.open(fileobj=io.BytesIO(archive),mode='r:xz') as tar:
                    members = tar.getnames()
                    self.assertEqual(len(members), len(build.SOURCE_FILES))
                    self.assertTrue(all(x.startswith('usr/local/emhttp/plugins/plugin.switch/') for x in members))
                    for name in members:
                        m = tar.getmember(name)
                        self.assertEqual((m.uid,m.gid,m.mtime), (0,0,0))
                    desc = tar.extractfile('usr/local/emhttp/plugins/plugin.switch/README.md').read().decode()
                    self.assertIn('**Plugin Switch**', desc)
                    self.assertIn('Update channel:', desc)
                    self.assertIn(branch, desc)
                    self.assertNotIn('__PLUGIN_SWITCH_BRANCH__', desc)
        with self.assertRaises(ValueError):
            build.build_archive('feature/test')

    def test_committed_package_matches_source(self):
        branch = os.environ.get('PLUGIN_SWITCH_BRANCH', 'dev')
        archive = build.build_archive(branch)
        self.assertEqual(build.archive_path().read_bytes(), archive)
        self.assertEqual((ROOT/'plugin.switch.plg').read_text(encoding='utf-8'), build.build(branch, archive))
        sha_file = build.archive_path().with_name(build.archive_filename()+'.sha256')
        self.assertEqual(sha_file.read_text(), hashlib.sha256(archive).hexdigest()+
                         '  '+build.archive_filename()+'\n')

    def test_frontend_reflects_registration_not_runtime_probe(self):
        script = (ROOT/'src/switch.js').read_text()
        self.assertIn("p.enabled ? 'true' : 'false'",script)
        self.assertIn('switchButton.disabled = !p.supported;',script)
        self.assertIn('role="switch"',script)
        self.assertIn("attachShadow({mode:'open'})",script)

    def test_controller_protects_critical_plugins(self):
        body = (ROOT/'src/Controller.php').read_text()
        self.assertIn('plugin.switch.plg',body)
        self.assertIn('unRAIDServer.plg',body)
        self.assertIn('flock($lock, LOCK_EX)',body)

if __name__ == '__main__':
    unittest.main()

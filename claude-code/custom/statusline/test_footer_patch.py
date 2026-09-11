import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('footer', Path(__file__).with_name('claude-footer-oneline.py'))
footer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(footer)


class FooterPatchTests(unittest.TestCase):
    def test_preserves_size_and_javascript_identifiers(self):
        for identifier in ('Aac', '$Ne', '_status'):
            source = (f'flexDirection:"column",flexShrink:1,children:[{identifier},WNe,!1]'
                      'paddingX:$x,gap:2,children:content').encode()
            patched = footer.patch_bytes(source)
            self.assertEqual(len(patched), len(source))
            self.assertIn(f'columnGap:2,children:[{identifier},WNe]'.encode(), patched)
            self.assertIn(b'flexGrow:1,gap:2,children:', patched)

    def test_rejects_unknown_layout(self):
        with self.assertRaises(SystemExit):
            footer.patch_bytes(b'unknown layout')

    def test_rejects_ambiguous_layout(self):
        source = b'flexDirection:"column",flexShrink:1,children:[A,B,!1]'
        with self.assertRaises(SystemExit):
            footer.patch_bytes(source + source)


if __name__ == '__main__':
    unittest.main()

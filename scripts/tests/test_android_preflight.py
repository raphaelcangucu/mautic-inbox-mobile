import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('preflight', Path(__file__).parents[1] / 'android-preflight.py')
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class ELFAlignmentTest(unittest.TestCase):
    def library(self, alignment, bits=64):
        data = bytearray(256)
        data[:6] = b'\x7fELF' + bytes([2 if bits == 64 else 1, 1])
        if bits == 64:
            struct.pack_into('<Q', data, 32, 64)
            struct.pack_into('<HH', data, 54, 56, 1)
            struct.pack_into('<I', data, 64, 1)
            struct.pack_into('<Q', data, 112, alignment)
        else:
            struct.pack_into('<I', data, 28, 52)
            struct.pack_into('<HH', data, 42, 32, 1)
            struct.pack_into('<I', data, 52, 1)
            struct.pack_into('<I', data, 80, alignment)
        return data

    def test_detects_4kb_incompatible_library(self):
        self.assertEqual(preflight.elf_load_alignments(self.library(4096)), [4096])

    def test_accepts_16kb_and_64kb_alignment(self):
        for alignment in (16384, 65536):
            self.assertEqual(preflight.elf_load_alignments(self.library(alignment)), [alignment])

    def test_reads_32_bit_elf(self):
        self.assertEqual(preflight.elf_load_alignments(self.library(16384, 32)), [16384])

    def test_rejects_non_elf(self):
        with self.assertRaises(ValueError):
            preflight.elf_load_alignments(b'not a native library')


class PNGTransparencyTest(unittest.TestCase):
    def check(self, color, chunk=b''):
        data = b'\x89PNG\r\n\x1a\n' + struct.pack('>I', 13) + b'IHDR'
        data += struct.pack('>IIBBBBB', 1080, 1920, 8, color, 0, 0, 0) + b'\0' * 4
        data += chunk + b'\0\0\0\0IEND' + b'\0' * 4
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'screen.png'
            path.write_bytes(data)
            return preflight.png_info(path)

    def test_rgb_has_no_alpha(self):
        self.assertEqual(self.check(2), (1080, 1920, 8, 2, False))

    def test_detects_rgba_and_transparent_rgb_chunk(self):
        self.assertTrue(self.check(6)[4])
        transparency = struct.pack('>I', 6) + b'tRNS' + b'\0' * 10
        self.assertTrue(self.check(2, transparency)[4])


if __name__ == '__main__':
    unittest.main()

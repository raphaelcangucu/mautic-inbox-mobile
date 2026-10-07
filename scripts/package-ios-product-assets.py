#!/usr/bin/env python3
"""Validate and package staged artwork; never changes the submitted listing."""
import argparse
import hashlib
import html
import json
from pathlib import Path
import shutil
import struct
import zipfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / 'app.json').read_text())['expo']
BUILD = str(CONFIG['ios']['buildNumber'])
OUT = ROOT / 'artifacts/publication' / f'product-assets-ios-{BUILD}'
COPY = json.loads((ROOT / 'fastlane/product-assets-ios/copy.json').read_text())
def load_original():
    path = ROOT / 'fastlane/screenshots/manifest.json'
    if not path.is_file():
        raise ValueError('Capture the current native build and create fastlane/screenshots/manifest.json before generating publication assets')
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def dimensions(path):
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'Not a PNG: {path}'
    width, height, depth, color_type = struct.unpack('>IIBB', data[16:26])
    assert depth == 8 and color_type == 2, f'Artwork must be opaque RGB: {path}'
    return [width, height]



def require(condition, message):
    if not condition:
        raise ValueError(message)


def review_matches(records):
    path = ROOT / 'fastlane/product-assets-ios' / f'reviewed-{BUILD}.json'
    if not path.exists():
        return False
    receipt = json.loads(path.read_text())
    return (receipt.get('version') == CONFIG['version'] and
            str(receipt.get('build')) == BUILD and
            receipt.get('copySha256') == digest(ROOT / 'fastlane/product-assets-ios/copy.json') and
            receipt.get('images') == {item['file']: item['sha256'] for item in records})


def check():
    ORIGINAL = load_original()
    manifest = json.loads((OUT / 'manifest.json').read_text())
    require(manifest['version'] == CONFIG['version'] and str(manifest['build']) == BUILD,
            'Product assets belong to another build/version')
    require(manifest.get('copySha256') == digest(ROOT / 'fastlane/product-assets-ios/copy.json'),
            'Publication copy changed: regenerate assets and inspect them')
    records = manifest['images']
    expected = {f'screenshots/{locale}/{kind}-{slide[0]}.png'
                for locale, copy in COPY.items() for kind in ['iphone-medium', 'ipad-13']
                for slide in copy['slides']}
    expected |= {f'social/{locale}/{name}.png' for locale in COPY
                 for name in ['hero-1200x630', 'social-1080x1350']}
    require(len(records) == len(expected) and {r['file'] for r in records} == expected,
            'Missing, duplicated or unexpected product images')
    require(manifest.get('visualReviewCompleted') is True and review_matches(records) and
            all(r.get('visuallyReviewed') is True for r in records),
            'Inspect previews and record exact image/copy hashes in reviewed-BUILD.json before upload')
    require({str(p.relative_to(OUT)) for p in (OUT / 'screenshots').rglob('*') if p.is_file()} ==
            {name for name in expected if name.startswith('screenshots/')},
            'Unexpected files in the screenshot upload directory')
    require(ORIGINAL['version'] == CONFIG['version'] and str(ORIGINAL['build']) == BUILD,
            'Native capture manifest belongs to another build')
    for item in records:
        path = OUT / item['file']
        require(digest(path) == item['sha256'], f'Artwork changed: {path}')
        require(dimensions(path) == item['dimensions'], f'Invalid dimensions: {path}')
        if item['file'].startswith('screenshots/'):
            size = [1206, 2622] if item['display'] == 'iphone-medium' else [2064, 2752]
            source = ROOT / item['sourceCapture']
            original = next((r for r in ORIGINAL['images'] if r['sourceCapture'] == item['sourceCapture']), None)
            require(original and original['sourceSha256'] == item['sourceSha256'] == digest(source),
                    f'Native capture changed: {source}')
            require(item['dimensions'] == size and item.get('realUI') is True and
                    item.get('installedBuildVerified') == BUILD and
                    item.get('captureKind') == 'native-iOS-simulator-Release' and
                    item.get('dataMode') == 'clearly-labelled-demo', 'Unverified native app screenshot')
    for locale, copy in COPY.items():
        for field, limit in [('name', 30), ('subtitle', 30), ('description', 4000),
                             ('promotional_text', 170), ('keywords', 100)]:
            require(0 < len(copy[field]) <= limit, f'Invalid {locale}/{field} length')
            require((OUT / 'metadata' / locale / f'{field}.txt').read_text() == copy[field] + '\n',
                    f'Metadata no longer matches publication copy: {locale}/{field}')
        for field in ['marketing_url', 'support_url', 'privacy_url', 'release_notes']:
            require((OUT / 'metadata' / locale / f'{field}.txt').read_bytes() ==
                    (ROOT / 'fastlane/metadata' / locale / f'{field}.txt').read_bytes(),
                    f'Preserved metadata changed: {locale}/{field}')
    print(json.dumps({'build': BUILD, 'storeImages': 30, 'socialImages': 6,
                      'visualReviewVerified': True, 'listingChanged': False}))


def main():
    ORIGINAL = load_original()
    assert ORIGINAL['version'] == CONFIG['version'] and str(ORIGINAL['build']) == BUILD
    records, counts = [], {}
    for locale, copy in COPY.items():
        counts[locale] = {}
        metadata = OUT / 'metadata' / locale
        metadata.mkdir(parents=True, exist_ok=True)
        for field, maximum in [('name', 30), ('subtitle', 30), ('description', 4000), ('promotional_text', 170), ('keywords', 100)]:
            value = copy[field]
            assert 0 < len(value) <= maximum, f'Invalid {locale}/{field}'
            if field == 'keywords':
                assert len(value.encode()) <= 100 and ' ' not in value
                assert len(value.split(',')) == len(set(value.split(',')))
            counts[locale][field] = {'characters': len(value), 'utf8Bytes': len(value.encode())}
            (metadata / f'{field}.txt').write_text(value + '\n')
        for name in ['marketing_url', 'support_url', 'privacy_url', 'release_notes']:
            shutil.copyfile(ROOT / 'fastlane/metadata' / locale / f'{name}.txt', metadata / f'{name}.txt')
        for kind, size in [('iphone-medium', [1206, 2622]), ('ipad-13', [2064, 2752])]:
            for slide in copy['slides']:
                original = next(item for item in ORIGINAL['images'] if item['locale'] == locale and item['display'] == kind and Path(item['sourceCapture']).stem == slide[1])
                source = ROOT / original['sourceCapture']
                assert digest(source) == original['sourceSha256'], f'Native source changed: {source}'
                assert original['realUI'] and original['installedBuildVerified'] == BUILD
                assert original['dataMode'] == 'clearly-labelled-demo'
                image = OUT / f'screenshots/{locale}/{kind}-{slide[0]}.png'
                assert dimensions(image) == size
                records.append({'file': str(image.relative_to(OUT)), 'sha256': digest(image),
                                'dimensions': size, 'locale': locale, 'display': kind,
                                'sourceCapture': original['sourceCapture'], 'sourceSha256': digest(source),
                                'captureKind': original['captureKind'], 'installedBuildVerified': BUILD,
                                'dataMode': original['dataMode'], 'realUI': True,
                                'composition': 'whole native display with uniform scaling; captions outside app pixels',
                                'visuallyReviewed': False})
        for name, size in [('hero-1200x630', [1200, 630]), ('social-1080x1350', [1080, 1350])]:
            image = OUT / f'social/{locale}/{name}.png'
            assert dimensions(image) == size
            records.append({'file': str(image.relative_to(OUT)), 'sha256': digest(image), 'dimensions': size,
                            'locale': locale, 'placement': 'website/social; not an App Store screenshot', 'visuallyReviewed': False})
    assert len(records) == 36
    reviewed = review_matches(records)
    for record in records:
        record['visuallyReviewed'] = reviewed
    copyright_file = ROOT / 'fastlane/metadata/copyright.txt'
    if copyright_file.exists():
        shutil.copyfile(copyright_file, OUT / 'metadata/copyright.txt')
    manifest = {'version': CONFIG['version'], 'build': BUILD, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'status': 'local candidate; not uploaded to App Store Connect', 'images': records,
                'copyCounts': counts, 'approvedListingChanged': False,
                'copySha256': digest(ROOT / 'fastlane/product-assets-ios/copy.json'),
                'visualReviewCompleted': reviewed,
                'officialSpecifications': ['https://developer.apple.com/app-store/product-page/',
                                           'https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/'],
                'verification': 'Visual review is tied to exact image and copy hashes in reviewed-BUILD.json. Swift rejects text overflow and cropped native displays.'}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    shutil.copyfile(ROOT / 'fastlane/product-assets-ios/copy.json', OUT / 'copy.json')
    (OUT / 'README.md').write_text(f'''# Mautic Inbox — coleção de produto iOS

30 imagens de loja: cinco telas reais de iPhone e cinco de iPad, em pt-BR, en-US e es-ES. Ordem: conversas, chat, assistente, comentários e conexões.

6 banners de divulgação: 1200 × 630 e 1080 × 1350, em três idiomas. Estes banners são para site/redes sociais, não para os slots de screenshots da Apple.

Texto localizado: nome, subtítulo, descrição, texto promocional e palavras-chave. Os arquivos de metadata usam a estrutura do Fastlane. URLs e notas públicas foram preservadas.

A interface foi capturada do build nativo {BUILD} em simuladores iOS, com dados de demonstração identificados. Somente composição externa e escala uniforme; sem interface recriada, traduções inseridas em mensagens ou conteúdo de clientes. O ícone do binário permanece igual.

Pacote candidato separado da ficha vigente: nada foi enviado, retirado da revisão ou alterado na App Store. Antes de substituir a ficha, verificar os campos editáveis no estado Apple atual e aplicar o manifesto próprio deste pacote. Não copiar estes arquivos sobre o manifesto da ficha enviada sem atualizar sua proveniência.

Prévia: abra index.html e selecione idioma/formato; clique em uma imagem para ver a resolução completa. Manifesto: manifest.json.

Reprodução: compile scripts/ios-product-assets.swift com swiftc; execute com ROOT OUTPUT LOCALE DEVICE (iphone-medium, ipad-13, social, board). Depois execute python3 scripts/package-ios-product-assets.py. Os scripts não acessam bancos, aparelhos ou APIs.
''')
    sections = []
    for locale, copy in COPY.items():
        for kind, title in [('iphone-medium', 'iPhone'), ('ipad-13', 'iPad'), ('social', 'Divulgação')]:
            names = [f'screenshots/{locale}/{kind}-{slide[0]}.png' for slide in copy['slides']] if kind != 'social' else [f'social/{locale}/hero-1200x630.png', f'social/{locale}/social-1080x1350.png']
            cards = ''.join(f'<a href="{name}" target="_blank" rel="noopener"><img loading="lazy" src="{name}" alt="{html.escape(copy["name"])} · {title}" /></a>' for name in names)
            sections.append(f'<section data-locale="{locale}" data-kind="{kind}"><div class="grid">{cards}</div></section>')
        description = html.escape(copy['description'])
        sections.append(f'<section data-locale="{locale}" data-kind="text"><article><h2>{html.escape(copy["subtitle"])}</h2><p class="promo">{html.escape(copy["promotional_text"])}</p><pre>{description}</pre><h3>Palavras-chave</h3><p>{html.escape(copy["keywords"])}</p></article></section>')
    document = '''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mautic Inbox · Assets iOS</title><style>
    :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#101e3a;color:#eef3ff;font:16px/1.6 system-ui,sans-serif}header,main{max-width:1600px;margin:auto;padding:32px}header{border-bottom:1px solid #35466a}h1{margin:0;font-size:32px}p{color:#c3cfe6}label{margin-right:20px}select{background:#223e77;border:1px solid #61789e;color:white;padding:10px 14px;border-radius:10px;font:inherit}nav{display:flex;gap:20px;flex-wrap:wrap}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:22px}.grid a{display:block}.grid img{display:block;width:100%;height:auto;border-radius:8px}section[hidden]{display:none}article{max-width:850px}pre{white-space:pre-wrap;font:inherit}.promo{border-left:3px solid #879fd4;padding-left:18px}@media(max-width:600px){header,main{padding:20px}.grid{grid-template-columns:1fr 1fr}h1{font-size:25px}}</style>
    <header><h1>Mautic Inbox · Coleção iOS</h1><p>Capturas reais do build __BUILD__. Pacote preparado localmente; a ficha em análise permanece intacta.</p><nav><label>Idioma <select id="locale"><option>pt-BR</option><option>en-US</option><option>es-ES</option></select></label><label>Material <select id="kind"><option value="iphone-medium">iPhone</option><option value="ipad-13">iPad</option><option value="social">Divulgação</option><option value="text">Texto da loja</option></select></label></nav></header><main>'''
    document += ''.join(sections)
    document += '''</main><script>function show(){document.querySelectorAll('section').forEach(s=>s.hidden=s.dataset.locale!==document.getElementById('locale').value||s.dataset.kind!==document.getElementById('kind').value)}document.querySelectorAll('select').forEach(s=>s.addEventListener('change',show));show()</script></html>'''
    (OUT / 'index.html').write_text(document.replace('__BUILD__', BUILD))
    archive = OUT.with_suffix('.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
        for path in sorted(OUT.rglob('*')):
            if path.is_file():
                package.write(path, Path(OUT.name) / path.relative_to(OUT))
    with zipfile.ZipFile(archive) as package:
        assert package.testzip() is None
    print(json.dumps({'storeImages': 30, 'socialImages': 6, 'locales': list(COPY),
                      'archive': str(archive), 'sha256': digest(archive), 'listingChanged': False}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='Read-only verification before upload')
    args = parser.parse_args()
    if args.check:
        check()
    else:
        main()

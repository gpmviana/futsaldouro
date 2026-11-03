import json, subprocess, sys, os
result = subprocess.run([sys.executable, '-m', 'yt_dlp', '--flat-playlist', '--dump-single-json', '--no-warnings', 'https://www.youtube.com/@FutsalDouro/videos'], capture_output=True, text=True, check=True)
data = json.loads(result.stdout)
items = [{'id': v['id'], 'title': v.get('title', 'Episódio')} for v in data.get('entries', []) if v and v.get('id') and len(v['id']) == 11]
if not items:
    raise RuntimeError('Nenhum vídeo recebido; preservando a lista anterior.')
with open('videos.json', 'w', encoding='utf-8') as f:
    json.dump(items, f, ensure_ascii=False, indent=2)
    f.write('\n')


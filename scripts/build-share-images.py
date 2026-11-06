# 매물 공유 미리보기 그림(m/img/<번호>-<표시>.png, 1200x630)을 만듭니다.
# build-share.mjs 가 남긴 scripts/.share-cards.json 을 읽어, 아직 없는 그림만 새로 그립니다.
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'scripts', 'fonts', 'NotoSansKR-Bold-subset.otf')
OUT = os.path.join(ROOT, 'm', 'img')
YEL, INK = (255, 210, 31), (29, 29, 31)
W, H, PAD = 1200, 630, 80

def fit(draw, text, size, maxw):
    while size > 40:
        f = ImageFont.truetype(FONT, size)
        if draw.textlength(text, font=f) <= maxw: return f
        size -= 4
    return ImageFont.truetype(FONT, size)

def render(card, path):
    im = Image.new('RGB', (W, H), YEL)
    d = ImageDraw.Draw(im)
    # 1줄: 단지명 + 평형 / 2줄: 금액
    f1 = fit(d, card['line1'], 92, W - PAD * 2)
    f2 = fit(d, card['line2'], 150, W - PAD * 2)
    d.text((W / 2, 175), card['line1'], font=f1, fill=INK, anchor='mm')
    d.text((W / 2, 330), card['line2'], font=f2, fill=INK, anchor='mm')
    # 아래: 검은 상자 + 노란 글씨 '반아나 마켓'
    fl = ImageFont.truetype(FONT, 64)
    tw = d.textlength('반아나 마켓', font=fl)
    bw, bh = tw + 72, 108
    x0, y0 = (W - bw) / 2, 470
    d.rounded_rectangle((x0, y0, x0 + bw, y0 + bh), radius=26, fill=INK)
    d.text((W / 2, y0 + bh / 2 - 4), '반아나 마켓', font=fl, fill=YEL, anchor='mm')
    im.save(path, optimize=True)

cards = json.load(open(os.path.join(ROOT, 'scripts', '.share-cards.json'), encoding='utf-8'))
os.makedirs(OUT, exist_ok=True)
want = set()
made = 0
for c in cards:
    want.add(c['file'])
    p = os.path.join(OUT, c['file'])
    if not os.path.exists(p):
        render(c, p); made += 1
for f in os.listdir(OUT):
    if f.endswith('.png') and f not in want: os.remove(os.path.join(OUT, f))
print(f'그림 {len(cards)}개 중 새로 그린 것 {made}개')

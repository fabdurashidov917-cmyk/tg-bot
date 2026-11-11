#!/bin/bash
# Kinobot webhook location blokini SIZNING_DOMEN.conf ga qo'shadi va nginx ni qayta yuklaydi.
set -e
CONF=/etc/nginx/sites-enabled/SIZNING_DOMEN.conf
FRAG="$(cd "$(dirname "$0")" && pwd)/nginx-kinobot.conf"
MARK="Kinobot webhook"

if sudo grep -q "$MARK" "$CONF"; then
  echo "✔️  Blok allaqachon qo'shilgan."
else
  sudo cp "$CONF" "$CONF.bak-kinobot-$(date +%Y%m%d_%H%M%S)"
  # 443 server blokidagi server_name qatoridan keyin qo'yamiz
  sudo python3 - "$CONF" "$FRAG" <<'PY'
import sys
conf, frag = sys.argv[1], sys.argv[2]
lines = open(conf).read().split('\n')
block = open(frag).read().rstrip('\n')
out, done, in443 = [], False, False
for i, l in enumerate(lines):
    out.append(l)
    if 'listen 443' in l:
        in443 = True
    if in443 and not done and l.strip().startswith('server_name'):
        out.append('')
        out.extend(block.split('\n'))
        done = True
open(conf, 'w').write('\n'.join(out))
print('qo\'shildi' if done else 'JOY TOPILMADI')
PY
fi

sudo nginx -t
sudo systemctl reload nginx
echo "✅ nginx qayta yuklandi"

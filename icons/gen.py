import struct, zlib

def create_png(size):
    bg = (217, 119, 6, 255)
    white = (255, 255, 255, 255)
    transparent = (0, 0, 0, 0)
    pixels = []
    rc = size // 4
    for y in range(size):
        row = []
        for x in range(size):
            in_corner = False
            for cx, cy in [(rc,rc),(size-1-rc,rc),(rc,size-1-rc),(size-1-rc,size-1-rc)]:
                if (x < rc or x > size-1-rc) and (y < rc or y > size-1-rc):
                    if (x-cx)**2 + (y-cy)**2 > rc*rc:
                        in_corner = True
            if in_corner:
                row.append(transparent)
            else:
                m = int(size*0.25)
                lw = max(1, size//12)
                is_line = False
                for i, ly in enumerate([int(size*0.33), int(size*0.50), int(size*0.67)]):
                    ex = size - m if i < 2 else int(size*0.58)
                    if m <= x <= ex and abs(y-ly) <= lw//2:
                        is_line = True
                row.append(white if is_line else bg)
        pixels.append(row)
    raw = b''
    for row in pixels:
        raw += b'\x00'
        for r,g,b,a in row:
            raw += struct.pack('BBBB', r, g, b, a)
    def chunk(ct, data):
        c = ct + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
    return png

for s in [16, 48, 128]:
    with open(f'icons/icon-{s}.png', 'wb') as f:
        f.write(create_png(s))
    print(f'Created icon-{s}.png')

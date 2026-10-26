"""Original seamless gallery finishes. Rebuild: python scripts/generate-gallery-textures.py.
Authoring only: requires Pillow/numpy, neither is a runtime dependency.
"""
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'public/textures/gallery'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = 512
y, x = np.mgrid[0:SIZE, 0:SIZE] / SIZE
rng = np.random.default_rng(261026)

def noise():
    result = np.zeros((SIZE, SIZE))
    for frequency, amplitude in [(1, 1), (2, .5), (4, .25), (8, .12), (24, .06), (64, .025)]:
        for _ in range(4):
            a, b = rng.integers(-frequency, frequency + 1, 2)
            result += amplitude * np.sin(2 * np.pi * (a*x + b*y) + rng.random()*2*np.pi)
    return result / (result.std() * 3)

def save(name, pixels):
    Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8)).save(OUT / name, optimize=True)

def normal(name, height, strength):
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    vectors = np.stack((-dx, dy, np.ones_like(height)), axis=-1)
    vectors /= np.linalg.norm(vectors, axis=-1, keepdims=True)
    save(name, (vectors * .5 + .5) * 255)

stone = noise()
pores = np.clip(noise() * 2 - .9, 0, 1)
veins = np.exp(-np.abs(np.sin(2*np.pi*(3*x + 2*y) + stone*.7)) * 45)
height = stone * .3 - pores * .08 - veins * .1
save('limestone-color.png', np.array([202, 196, 182]) + (stone*10 - veins*12 - pores*7)[..., None])
save('limestone-roughness.png', 180 + stone*12 + pores*20)
normal('limestone-normal.png', height, 2)
plaster = noise()
save('plaster-color.png', np.array([229, 224, 213]) + (plaster*4)[..., None])
normal('plaster-normal.png', plaster, .7)
grain = np.sin(2*np.pi*38*x + 3*np.sin(2*np.pi*y) + noise()*1.4)
fine_grain = np.sin(2*np.pi*137*x + np.sin(2*np.pi*y)*4)
save('walnut-color.png', np.array([83, 56, 38]) + (grain*9 + fine_grain*2 + noise()*7)[..., None])
normal('walnut-normal.png', grain*.4 + fine_grain*.12, .7)
radius = np.sqrt(((x-.5)*2)**2 + ((y-.5)*2)**2)
alpha = np.exp(-radius*radius*5) * np.clip((1-radius)*5, 0, 1) * 155
save('contact-shadow.png', np.stack((np.zeros_like(alpha), np.zeros_like(alpha), np.zeros_like(alpha), alpha), axis=-1))
print(f'Wrote 8 original {SIZE}px textures to {OUT}')

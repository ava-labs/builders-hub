import { DataTexture, ImageBitmapLoader, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, Texture, type WebGLRenderer } from "three";
import { WARM, waitFor } from "./warmup";

/* A tiling image for the scene (the marble, the cloud sea), decoded off
   the main thread and put on the GPU a strip at a time, each strip in its
   own task, so no frame waits on it: an <img> handed to three decodes and
   converts on the main thread inside the frame that first draws it, 50 ms
   for a 2048 px tile (130 ms on a slow CPU), and a decoded bitmap sent up
   whole still held the page 50 ms while the GPU process compiled the
   city's programs. A strip of 256 rows goes up in a millisecond or two. */

const ROWS = 256;
/* a bitmap that has waited this long for the programs goes up anyway */
const QUIET_BY_MS = 8000;

/** a tile's texture once it is on the GPU; null when the image does not come. The canvas waits for a tile asked for
    before it shows (warmup.tsx) */
export function loadTile(gl: WebGLRenderer, url: string, anisotropy: number): Promise<Texture | null> {
  return waitFor(new Promise((done) => {
    new ImageBitmapLoader().setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" }).load(
      url,
      (bitmap) => {
        const t = new Texture(bitmap);
        // the bitmap is flipped as it decodes: WebGL does not flip a bitmap on upload
        t.flipY = false;
        t.colorSpace = SRGBColorSpace;
        t.wrapS = t.wrapT = RepeatWrapping;
        t.minFilter = LinearMipmapLinearFilter;
        t.anisotropy = anisotropy;
        // three makes the texture's storage and sets it up; its texels follow here, a strip a task
        t.source.dataReady = false;
        t.needsUpdate = true;
        const ctx = gl.getContext() as WebGL2RenderingContext;
        let y = 0;
        const since = performance.now();
        const strip = () => {
          if (ctx.isContextLost()) return done(null);
          // a bitmap's first strip waits on the GPU process, which on a cold cache compiles the city's programs for seconds:
          // there it goes up once they are made (WARM.quiet)
          if (y === 0 && !WARM.quiet && performance.now() - since < QUIET_BY_MS) return void setTimeout(strip, 50);
          if (y === 0) gl.initTexture(t);
          const handle = (gl.properties.get(t) as { __webglTexture?: WebGLTexture }).__webglTexture;
          if (!handle) return done(null);
          gl.state.bindTexture(ctx.TEXTURE_2D, handle);
          ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, false);
          ctx.pixelStorei(ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          ctx.pixelStorei(ctx.UNPACK_ALIGNMENT, 4);
          const rows = Math.min(ROWS, bitmap.height - y);
          ctx.pixelStorei(ctx.UNPACK_SKIP_ROWS, y);
          ctx.texSubImage2D(ctx.TEXTURE_2D, 0, 0, y, bitmap.width, rows, ctx.RGBA, ctx.UNSIGNED_BYTE, bitmap);
          ctx.pixelStorei(ctx.UNPACK_SKIP_ROWS, 0);
          y += rows;
          if (y < bitmap.height) return void setTimeout(strip, 0);
          ctx.generateMipmap(ctx.TEXTURE_2D);
          done(t);
        };
        setTimeout(strip, 0);
      },
      undefined,
      () => done(null),
    );
  }));
}

/** a white texel: a material that takes a tile later has a map from its first frame, so the tile's coming compiles nothing */
export function whiteTile(): Texture {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

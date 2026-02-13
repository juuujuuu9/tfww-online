import { Vector3 } from 'three';
import { Effect, EffectAttribute } from 'postprocessing';

/**
 * Dithering effect implementing ordered dithering with a 4x4 Bayer matrix.
 * Based on the dithering shader from https://github.com/niccolofanton/dithering-shader
 */
export class DitheringEffect extends Effect {
  private static readonly FRAGMENT_SHADER = `
    uniform float gridSize;
    uniform float pixelSizeRatio;
    uniform bool grayscaleOnly;
    uniform bool ditheringEnabled;
    uniform bool invertColor;
    uniform bool useCustomLightColor;
    uniform vec3 colorDark;
    uniform vec3 colorLight;
    uniform vec2 resolution;

    // 4x4 Bayer matrix for ordered dithering
    bool getValue(float brightness, vec2 pos) {
      vec2 pixel = floor(mod(pos.xy / gridSize, 4.0));
      
      // 4x4 Bayer matrix threshold values (0-15 normalized to 0-1)
      float bayerValue = 0.0;
      
      if (pixel.x == 0.0 && pixel.y == 0.0) bayerValue = 0.0;
      else if (pixel.x == 1.0 && pixel.y == 0.0) bayerValue = 8.0;
      else if (pixel.x == 2.0 && pixel.y == 0.0) bayerValue = 2.0;
      else if (pixel.x == 3.0 && pixel.y == 0.0) bayerValue = 10.0;
      else if (pixel.x == 0.0 && pixel.y == 1.0) bayerValue = 12.0;
      else if (pixel.x == 1.0 && pixel.y == 1.0) bayerValue = 4.0;
      else if (pixel.x == 2.0 && pixel.y == 1.0) bayerValue = 14.0;
      else if (pixel.x == 3.0 && pixel.y == 1.0) bayerValue = 6.0;
      else if (pixel.x == 0.0 && pixel.y == 2.0) bayerValue = 3.0;
      else if (pixel.x == 1.0 && pixel.y == 2.0) bayerValue = 11.0;
      else if (pixel.x == 2.0 && pixel.y == 2.0) bayerValue = 1.0;
      else if (pixel.x == 3.0 && pixel.y == 2.0) bayerValue = 9.0;
      else if (pixel.x == 0.0 && pixel.y == 3.0) bayerValue = 15.0;
      else if (pixel.x == 1.0 && pixel.y == 3.0) bayerValue = 7.0;
      else if (pixel.x == 2.0 && pixel.y == 3.0) bayerValue = 13.0;
      else if (pixel.x == 3.0 && pixel.y == 3.0) bayerValue = 5.0;
      
      // Normalize to 0-1 range and apply threshold
      float threshold = (bayerValue + 0.5) / 16.0;
      
      return brightness > threshold;
    }

    void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
      if (!ditheringEnabled) {
        outputColor = inputColor;
        return;
      }

      // Skip dithering for transparent/background/semi-transparent pixels; output transparent so page background shows through (no white band)
      if (inputColor.a < 0.2) {
        outputColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
      }

      // Calculate pixelated coordinates
      vec2 fragCoord = uv * resolution;
      float pixelSize = gridSize * pixelSizeRatio;
      vec2 pixelatedCoord = floor(fragCoord / pixelSize) * pixelSize;
      vec2 pixelatedUV = pixelatedCoord / resolution;
      
      // Sample color from pixelated block center
      vec4 baseColor = texture2D(inputBuffer, pixelatedUV);
      
      // Skip dithering when block is semi-transparent; output transparent so no white band or ghosting
      if (baseColor.a < 0.2) {
        outputColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
      }
      
      // Calculate luminance for dithering decision
      float luminance = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));
      
      // Apply grayscale if enabled
      vec3 color = baseColor.rgb;
      if (grayscaleOnly) {
        color = vec3(luminance);
      }
      
      // Apply dithering
      bool ditherValue = getValue(luminance, pixelatedCoord);
      vec3 lightColor = useCustomLightColor ? colorLight : color;
      vec3 finalColor = ditherValue ? lightColor : colorDark;
      
      // Apply color inversion if enabled
      if (invertColor) {
        finalColor = 1.0 - finalColor;
      }
      
      outputColor = vec4(finalColor, baseColor.a);
    }
  `;

  constructor(options: {
    gridSize?: number;
    pixelSizeRatio?: number;
    grayscaleOnly?: boolean;
    ditheringEnabled?: boolean;
    invertColor?: boolean;
    /** Dark color [r,g,b] 0-1 (pixels below threshold). Default: black */
    colorDark?: [number, number, number];
    /** Light color [r,g,b] 0-1 (pixels above threshold). When set, overrides scene color */
    colorLight?: [number, number, number];
  } = {}) {
    const colorDark = options.colorDark ?? [0, 0, 0];
    const colorLight = options.colorLight ?? [1, 1, 1];
    super('DitheringEffect', DitheringEffect.FRAGMENT_SHADER, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['gridSize', { value: options.gridSize ?? 4.0 }],
        ['pixelSizeRatio', { value: options.pixelSizeRatio ?? 1.0 }],
        ['grayscaleOnly', { value: options.grayscaleOnly ?? false }],
        ['ditheringEnabled', { value: options.ditheringEnabled ?? true }],
        ['invertColor', { value: options.invertColor ?? false }],
        ['useCustomLightColor', { value: options.colorLight != null }],
        ['colorDark', { value: new Vector3(...colorDark) }],
        ['colorLight', { value: new Vector3(...colorLight) }],
        ['resolution', { value: [window.innerWidth, window.innerHeight] }]
      ])
    });
  }

  /**
   * Sets the dithering grid size
   * @param size - Grid size (1-20, default: 4.0)
   */
  setGridSize(size: number): void {
    this.uniforms.get('gridSize')!.value = Math.max(1, Math.min(20, size));
  }

  /**
   * Sets the pixel size ratio for intensified pixelation
   * @param ratio - Pixel size ratio (1-10, default: 1.0)
   */
  setPixelSizeRatio(ratio: number): void {
    this.uniforms.get('pixelSizeRatio')!.value = Math.max(1, Math.min(10, ratio));
  }

  /**
   * Toggles grayscale mode
   * @param grayscale - Enable grayscale only mode
   */
  setGrayscaleOnly(grayscale: boolean): void {
    this.uniforms.get('grayscaleOnly')!.value = grayscale;
  }

  /**
   * Enables or disables the dithering effect
   * @param enabled - Enable dithering effect
   */
  setDitheringEnabled(enabled: boolean): void {
    this.uniforms.get('ditheringEnabled')!.value = enabled;
  }

  /**
   * Toggles color inversion
   * @param invert - Enable color inversion
   */
  setInvertColor(invert: boolean): void {
    this.uniforms.get('invertColor')!.value = invert;
  }

  /**
   * Updates the resolution uniform for proper pixel calculations
   * @param width - Screen width
   * @param height - Screen height
   */
  setResolution(width: number, height: number): void {
    this.uniforms.get('resolution')!.value = [width, height];
  }

  /**
   * Sets the dark color for dither pixels (below threshold)
   * @param rgb - RGB values 0-1, e.g. [0, 0, 0] for black
   */
  setColorDark(rgb: [number, number, number]): void {
    const u = this.uniforms.get('colorDark')!.value as Vector3;
    u.set(rgb[0], rgb[1], rgb[2]);
  }

  /**
   * Sets the light color for dither pixels (above threshold). Pass null to use scene color.
   * @param rgb - RGB values 0-1, or null for scene color
   */
  setColorLight(rgb: [number, number, number] | null): void {
    this.uniforms.get('useCustomLightColor')!.value = rgb != null;
    if (rgb != null) {
      const u = this.uniforms.get('colorLight')!.value as Vector3;
      u.set(rgb[0], rgb[1], rgb[2]);
    }
  }

  /**
   * Sets both dither colors
   * @param dark - Dark pixel color [r,g,b] 0-1
   * @param light - Light pixel color [r,g,b] 0-1, or null for scene color
   */
  setColors(dark: [number, number, number], light?: [number, number, number] | null): void {
    this.setColorDark(dark);
    this.setColorLight(light ?? null);
  }

  /**
   * Gets the current grid size
   */
  getGridSize(): number {
    return this.uniforms.get('gridSize')!.value;
  }

  /**
   * Gets the current pixel size ratio
   */
  getPixelSizeRatio(): number {
    return this.uniforms.get('pixelSizeRatio')!.value;
  }

  /**
   * Gets whether grayscale mode is enabled
   */
  getGrayscaleOnly(): boolean {
    return this.uniforms.get('grayscaleOnly')!.value;
  }

  /**
   * Gets whether dithering is enabled
   */
  getDitheringEnabled(): boolean {
    return this.uniforms.get('ditheringEnabled')!.value;
  }

  /**
   * Gets the dark color [r,g,b] 0-1
   */
  getColorDark(): [number, number, number] {
    const u = this.uniforms.get('colorDark')!.value as Vector3;
    return [u.x, u.y, u.z];
  }

  /**
   * Gets the light color [r,g,b] 0-1, or null if using scene color
   */
  getColorLight(): [number, number, number] | null {
    if (!this.uniforms.get('useCustomLightColor')!.value) return null;
    const u = this.uniforms.get('colorLight')!.value as Vector3;
    return [u.x, u.y, u.z];
  }
}
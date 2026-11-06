import imageMap from "./optimized-image-map.js?v=1.0.3";

export function createOptimizedImageResolver(map, root = new URL("../", import.meta.url)) {
  return (path) => {
    if (typeof path !== "string" || !path) return path;
    try {
      const source = new URL(path, root);
      if (source.origin !== root.origin || !source.pathname.startsWith(root.pathname)) return path;
      const key = decodeURIComponent(source.pathname.slice(root.pathname.length)).normalize("NFC");
      if (!Object.hasOwn(map, key)) return path;
      const optimized = new URL(map[key], root);
      optimized.search = source.search;
      optimized.hash = source.hash;
      return optimized.href;
    } catch {
      return path;
    }
  };
}

export const optimizedImageUrl = createOptimizedImageResolver(imageMap);

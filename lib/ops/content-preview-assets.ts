// Byte-verified mirrors of the existing preview proposal. Never alters its signed payload.
export const contentPreviewHashes = [
  "0448912c5d8a9b87d237adb7205e344c8ca1016cb8c43e002799d15b52148e80",
  "09c42d66fc93f5e1aedcc4e85f87cb51c750889afd00bf3fbda15c8897ca8ddc",
  "4616f43d19dcedbd7fe3219a7996f046c58c360de6f10c6d3d24159ba95cce38",
  "6c77badfb13c0c1a306124c0704a2c32968e53b75b2a5e903ab028d6388549ff",
  "9bdc9cc13eed3ce08b56977ee3380b7e1021d72400c137ac79898fb4e594f071",
] as const;
const sourceOrigin =
  "https://marc-watters-site-16pby9lsy-kevinflowstate-7682s-projects.vercel.app";
export function bundledContentPreview(media: {
  url?: unknown;
  sha256?: unknown;
}): string | null {
  const hash = media.sha256;
  if (
    typeof hash !== "string" ||
    !contentPreviewHashes.some((value) => value === hash)
  )
    return null;
  const path = `/ops-drafts/cbb-busy-profitable-v2/${hash}.png`;
  return media.url === `${sourceOrigin}${path}` ? path : null;
}

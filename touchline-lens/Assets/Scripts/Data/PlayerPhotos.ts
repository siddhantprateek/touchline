// PlayerPhotos — optional portrait photos for the player card, keyed by StatsBomb player id.
// The portraits are freely licensed Wikimedia Commons images (CC BY / CC BY-SA / CC0), fetched
// by tools/photos/fetch_photos.py; author, licence and source for each are in
// tools/photos/credits.json and the README. Players without an entry get the kit-coloured
// placeholder portrait.
//
// To add or swap a photo you have the rights to use:
//   1. Drop a 256x290 transparent PNG cut-out into Assets/Players/, e.g. Assets/Players/6909.png
//      (tools/photos/cutout_photos.py makes one from any credited photo).
//   2. Add/replace a line below:  6909: requireAsset("../../Players/6909.png") as Texture,
export const PLAYER_PHOTOS: {[playerId: number]: Texture} = {
  10481: requireAsset("../../Players/10481.png") as Texture,
  11135: requireAsset("../../Players/11135.png") as Texture,
  11456: requireAsset("../../Players/11456.png") as Texture,
  11990: requireAsset("../../Players/11990.png") as Texture,
  16308: requireAsset("../../Players/16308.png") as Texture,
  19597: requireAsset("../../Players/19597.png") as Texture,
  20572: requireAsset("../../Players/20572.png") as Texture,
  22097: requireAsset("../../Players/22097.png") as Texture,
  24778: requireAsset("../../Players/24778.png") as Texture,
  27886: requireAsset("../../Players/27886.png") as Texture,
  28263: requireAsset("../../Players/28263.png") as Texture,
  29201: requireAsset("../../Players/29201.png") as Texture,
  29560: requireAsset("../../Players/29560.png") as Texture,
  2972: requireAsset("../../Players/2972.png") as Texture,
  2995: requireAsset("../../Players/2995.png") as Texture,
  3009: requireAsset("../../Players/3009.png") as Texture,
  3026: requireAsset("../../Players/3026.png") as Texture,
  3090: requireAsset("../../Players/3090.png") as Texture,
  3099: requireAsset("../../Players/3099.png") as Texture,
  3604: requireAsset("../../Players/3604.png") as Texture,
  38718: requireAsset("../../Players/38718.png") as Texture,
  4445: requireAsset("../../Players/4445.png") as Texture,
  5477: requireAsset("../../Players/5477.png") as Texture,
  5485: requireAsset("../../Players/5485.png") as Texture,
  5487: requireAsset("../../Players/5487.png") as Texture,
  5503: requireAsset("../../Players/5503.png") as Texture,
  5507: requireAsset("../../Players/5507.png") as Texture,
  5743: requireAsset("../../Players/5743.png") as Texture,
  6704: requireAsset("../../Players/6704.png") as Texture,
  6909: requireAsset("../../Players/6909.png") as Texture,
  7161: requireAsset("../../Players/7161.png") as Texture,
  7439: requireAsset("../../Players/7439.png") as Texture,
  7797: requireAsset("../../Players/7797.png") as Texture,
  8217: requireAsset("../../Players/8217.png") as Texture,
  8519: requireAsset("../../Players/8519.png") as Texture,
}

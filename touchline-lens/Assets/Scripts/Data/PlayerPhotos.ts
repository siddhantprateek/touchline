// PlayerPhotos — optional portrait photos for the player card, keyed by StatsBomb player id.
// The portraits are freely licensed Wikimedia Commons images (CC BY / CC BY-SA / CC0), fetched
// by tools/photos/fetch_photos.py; author, licence and source for each are in
// tools/photos/credits.json and the README. Players without an entry get the kit-coloured
// placeholder portrait.
//
// To add or swap a photo you have the rights to use:
//   1. Drop a ~256x290 image into Assets/Players/, e.g. Assets/Players/6909.jpg.
//   2. Add/replace a line below:  6909: requireAsset("../../Players/6909.jpg") as Texture,
export const PLAYER_PHOTOS: {[playerId: number]: Texture} = {
  10481: requireAsset("../../Players/10481.jpg") as Texture,
  11135: requireAsset("../../Players/11135.jpg") as Texture,
  11456: requireAsset("../../Players/11456.jpg") as Texture,
  11990: requireAsset("../../Players/11990.jpg") as Texture,
  16308: requireAsset("../../Players/16308.jpg") as Texture,
  19597: requireAsset("../../Players/19597.jpg") as Texture,
  20572: requireAsset("../../Players/20572.jpg") as Texture,
  22097: requireAsset("../../Players/22097.jpg") as Texture,
  24778: requireAsset("../../Players/24778.jpg") as Texture,
  27886: requireAsset("../../Players/27886.jpg") as Texture,
  28263: requireAsset("../../Players/28263.jpg") as Texture,
  29201: requireAsset("../../Players/29201.jpg") as Texture,
  29560: requireAsset("../../Players/29560.jpg") as Texture,
  2972: requireAsset("../../Players/2972.jpg") as Texture,
  2995: requireAsset("../../Players/2995.jpg") as Texture,
  3009: requireAsset("../../Players/3009.jpg") as Texture,
  3026: requireAsset("../../Players/3026.jpg") as Texture,
  3090: requireAsset("../../Players/3090.jpg") as Texture,
  3099: requireAsset("../../Players/3099.jpg") as Texture,
  3604: requireAsset("../../Players/3604.jpg") as Texture,
  38718: requireAsset("../../Players/38718.jpg") as Texture,
  4445: requireAsset("../../Players/4445.jpg") as Texture,
  5477: requireAsset("../../Players/5477.jpg") as Texture,
  5485: requireAsset("../../Players/5485.jpg") as Texture,
  5487: requireAsset("../../Players/5487.jpg") as Texture,
  5503: requireAsset("../../Players/5503.jpg") as Texture,
  5507: requireAsset("../../Players/5507.jpg") as Texture,
  5743: requireAsset("../../Players/5743.jpg") as Texture,
  6704: requireAsset("../../Players/6704.jpg") as Texture,
  6909: requireAsset("../../Players/6909.jpg") as Texture,
  7161: requireAsset("../../Players/7161.jpg") as Texture,
  7439: requireAsset("../../Players/7439.jpg") as Texture,
  7797: requireAsset("../../Players/7797.jpg") as Texture,
  8217: requireAsset("../../Players/8217.jpg") as Texture,
  8519: requireAsset("../../Players/8519.jpg") as Texture,
}

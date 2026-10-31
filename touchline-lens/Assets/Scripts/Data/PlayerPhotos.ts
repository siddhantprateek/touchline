// PlayerPhotos — optional portrait photos for the player card, keyed by StatsBomb player id.
// No photos ship with the project: player photos are copyrighted, and the Devpost rules ask for
// no copyrighted material. Players without an entry get the kit-coloured placeholder portrait.
//
// To add a photo you have the rights to use (own photo, or a freely licensed one such as a
// Wikimedia Commons image, with its credit added to the README):
//   1. Drop the image into Assets/Players/, e.g. Assets/Players/6909.png (square-ish, ~256 px).
//   2. Add a line below:  6909: requireAsset("../../Players/6909.png") as Texture,
export const PLAYER_PHOTOS: {[playerId: number]: Texture} = {}

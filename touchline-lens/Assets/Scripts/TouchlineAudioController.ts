// TouchlineAudioController — crowd roar (soft for shots, louder for goals) and the net sound.
// Owns: the AudioComponents (on this SceneObject, which sits at the pitch so the sound
// comes from the table) and their volumes. Must not: decide when a moment happens.
@component
export class TouchlineAudioController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">TouchlineAudioController – crowd roar + net</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Soft crowd roar played when a shot moment is reached")
  roarSoft: AudioTrackAsset

  @input
  @hint("Loud crowd roar played for goals")
  roarGoal: AudioTrackAsset

  @input
  @hint("Ball-in-net sound played when the pop-out arc lands")
  netHit: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Volume of the soft (shot) roar")
  @widget(new SliderWidget(0, 1, 0.01))
  softVolume: number = 0.35

  @input
  @hint("Volume of the goal roar")
  @widget(new SliderWidget(0, 1, 0.01))
  goalVolume: number = 0.85

  @input
  @hint("Volume of the net sound")
  @widget(new SliderWidget(0, 1, 0.01))
  netVolume: number = 0.9

  @input
  @hint("Spatialise the sound at the pitch (needs an Audio Listener on the camera)")
  spatial: boolean = false
  @ui.group_end

  private soft: AudioComponent
  private goal: AudioComponent
  private net: AudioComponent

  onAwake(): void {
    this.soft = this.make(this.roarSoft, Audio.PlaybackMode.LowPower)
    this.goal = this.make(this.roarGoal, Audio.PlaybackMode.LowPower)
    this.net = this.make(this.netHit, Audio.PlaybackMode.LowLatency)
  }

  playRoar(isGoal: boolean): void {
    if (isGoal) this.fire(this.goal, this.goalVolume)
    else this.fire(this.soft, this.softVolume)
  }

  playNet(): void {
    this.fire(this.net, this.netVolume)
  }

  private make(track: AudioTrackAsset, mode: Audio.PlaybackMode): AudioComponent {
    if (!track) return null
    const a = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    a.audioTrack = track
    try {
      a.playbackMode = mode
    } catch (e) {
      // older runtimes: default mode is fine
    }
    if (this.spatial) {
      try {
        a.spatialAudio.enabled = true
      } catch (e) {
        print("[TouchlineAudioController] spatial audio unavailable: " + e)
      }
    }
    return a
  }

  private fire(a: AudioComponent, volume: number): void {
    if (!a) return
    a.volume = volume
    if (a.isPlaying()) a.stop(false)
    a.play(1)
  }
}

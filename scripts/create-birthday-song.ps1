$ErrorActionPreference = 'Stop'
$songRoot = Split-Path -Parent $PSScriptRoot
$sampleDirectory = Join-Path $songRoot 'tmp/birthday-song'
New-Item -ItemType Directory -Force -Path $sampleDirectory | Out-Null
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$nicknames = @('Rubsi', 'Ruben', ('R' + [char]0xfc + 'bi'), 'Rudi', 'Pupsi')
try {
  $speaker.SelectVoice('Microsoft Hedda Desktop')
  $speaker.Rate = 1
  for ($index = 0; $index -lt $nicknames.Length; $index++) {
    foreach ($kind in @('birthday', 'name')) {
      $text = if ($kind -eq 'birthday') { 'Happy Birthday, ' + $nicknames[$index] + '!' } else { $nicknames[$index] + '!' }
      $speaker.SetOutputToWaveFile((Join-Path $sampleDirectory "$kind-$index.wav"), $format)
      $speaker.Speak($text)
      $speaker.SetOutputToNull()
    }
  }
  $speaker.SetOutputToWaveFile((Join-Path $sampleDirectory 'outro.wav'), $format)
  $speaker.Speak('Alles Gute! Heute feiern wir dich!')
  $speaker.SetOutputToNull()
} finally {
  $speaker.Dispose()
}
node (Join-Path $PSScriptRoot 'render-birthday-song.cjs') $sampleDirectory
if ($LASTEXITCODE -ne 0) { throw 'Song rendering failed.' }
New-Item -ItemType Directory -Force -Path (Join-Path $songRoot 'public/audio') | Out-Null
ffmpeg -hide_banner -loglevel error -y -i (Join-Path $sampleDirectory 'birthday-song.wav') -codec:a libmp3lame -b:a 192k (Join-Path $songRoot 'public/audio/happy-birthday-rubsi.mp3')
if ($LASTEXITCODE -ne 0) { throw 'MP3 encoding failed.' }

# Dictation Mode

## Overview

A toggle-based dictation feature that streams microphone audio to a WhisperLiveKit server via WebSocket and inserts transcribed text into a textarea. Users can seamlessly switch between dictation and keyboard input within the same recording session.

## Architecture

- **Client** captures audio via `MediaRecorder` (WebM/Opus) and streams chunks over WebSocket to a WhisperLiveKit instance.
- **Server** exposes the WhisperLiveKit WebSocket URL to the client via a configuration endpoint. The browser connects directly to WhisperLiveKit — no server-side proxy.
- The dictation feature is **opt-in**: the mic button only appears when a WhisperLiveKit URL is configured (e.g. via environment variable).

## WhisperLiveKit Protocol

**Client sends:** Binary WebSocket messages containing WebM/Opus audio chunks (emitted every 250ms via `MediaRecorder.start(250)`). An empty blob signals end-of-stream.

**Server returns:** JSON messages at ~20Hz:

```json
{
  "lines": [{ "text": "finalized text", "start": "0:00:01", "end": "0:00:03" }],
  "buffer_transcription": " in-progress text",
  "status": "active_transcription"
}
```

The full transcript is: all `lines[].text` concatenated + `buffer_transcription`. Each message contains the **complete accumulated transcript** since the WebSocket connection opened — not a delta.

## Dictation Model

The textarea has two layers of content:

1. **Base input** — committed text that the user owns (typed, pasted, or previously committed from dictation).
2. **Ephemeral transcript** — the current WhisperLiveKit transcript, spliced into the base at a fixed insertion point.

The displayed textarea value is always:

```
base[0..insertPos] + separator + transcript + separator + base[insertPos..]
```

Where separators are single spaces added only when needed to avoid double-spaces or missing spaces at the boundaries.

### Starting a Recording

1. Capture the microphone via `getUserMedia({ audio: true })`.
2. Snapshot the current textarea value as the **base input**.
3. Snapshot the current cursor position as the **insertion point**.
4. Open a WebSocket connection to WhisperLiveKit.
5. On WebSocket open, create a `MediaRecorder` and start streaming audio chunks.
6. Show the recording state in the UI.

### During Recording

- Each WebSocket message updates the ephemeral transcript and recomputes the displayed value.
- **Only update the textarea when the transcript text actually changes** — this prevents unnecessary re-renders that would reset the cursor position.
- After updating the textarea value, **restore the cursor position** to the end of the spliced dictation region (i.e., after `base[0..insertPos] + separator + transcript`). Only do this if the textarea is the active element.

### Committing (User Takes Control)

When the user interacts with the textarea via **pointer down** or **key down** while there is uncommitted ephemeral transcript:

1. Adopt the current displayed value (base + transcript) as the **new base input**.
2. Update the **insertion point** to the current cursor position.
3. Clear the ephemeral transcript.
4. **Tear down the current WebSocket** and open a new one. This resets the WhisperLiveKit transcript to empty, so subsequent messages start fresh. The microphone stream stays alive — only the WebSocket and MediaRecorder are recycled.

If there is no ephemeral transcript when the user interacts, do nothing — let normal input behavior proceed without interruption.

### Stopping Recording

1. Stop the `MediaRecorder`.
2. Send an empty blob (end-of-stream signal) and close the WebSocket.
3. Stop all microphone tracks (release the mic at the OS level).
4. Clear the ephemeral transcript. The current displayed value remains as-is (the last splice is now permanent).

### Sending a Message While Recording

1. Capture the current textarea value as the message text.
2. Clear the textarea, base input, insertion point, and ephemeral transcript.
3. **Reconnect the WebSocket** (same as commit — tear down and reopen) so that new speech after sending starts with a fresh transcript.
4. The microphone stays active. The user can keep talking and a new transcription accumulates from scratch.

## UI

### Mic Button

Placed in the input area alongside other action buttons. Three visual states:

| State | Icon | Button Style | Behavior |
|---|---|---|---|
| **Ready** | Microphone (solid/filled) | Default | Tap to start recording |
| **Recording** | Microphone (outline) | Inverted (solid fill background, contrasting icon) | Tap to stop recording |
| **Unavailable** | Microphone with slash | Disabled | Cannot reach WhisperLiveKit. Button is non-interactive. |

- The button is **hidden entirely** when no WhisperLiveKit URL is configured.
- The **unavailable** state is set when a WebSocket connection fails (`onerror`). It resets to **ready** on the next successful connection (`onopen`).

## Acceptance Criteria

### Basic Flow
- [ ] Tapping the mic button starts recording; the button changes to the recording state.
- [ ] Speech is transcribed and appears in the textarea in real-time.
- [ ] Tapping the mic button again stops recording; the transcribed text remains in the textarea.
- [ ] The transcribed text can be edited normally after stopping.
- [ ] The message can be sent normally (via send button or Enter key).

### Cursor-Aware Insertion
- [ ] Dictation text is inserted at the cursor position that was active when recording started.
- [ ] Text before and after the cursor is preserved.
- [ ] Appropriate word-boundary spacing is added automatically at the splice points.
- [ ] The cursor remains positioned at the end of the dictation region during transcription updates, not at the end of the entire field.
- [ ] The cursor is only repositioned if the textarea is the active/focused element.

### Seamless Keyboard/Dictation Switching
- [ ] Typing in the textarea while recording commits the current transcript and starts a new one.
- [ ] After committing, the new transcript inserts at the updated cursor position.
- [ ] The microphone stays active across commits — only the WebSocket reconnects.
- [ ] Typing in the textarea while recording does not cause the cursor to jump.
- [ ] If there is no ephemeral transcript, interacting with the textarea does not trigger a commit or WebSocket reconnect.
- [ ] The base input updates on every keystroke while recording, so the next transcript splices into current content.

### Send While Recording
- [ ] Sending a message while recording clears the textarea.
- [ ] The WebSocket reconnects so new speech starts a fresh transcript.
- [ ] The microphone stays active — no need to re-tap the mic button.
- [ ] The old transcript does not reappear in the textarea after sending.

### Error Handling
- [ ] If WhisperLiveKit is unreachable, the button shows the unavailable state and is disabled.
- [ ] If the connection drops during recording, recording stops gracefully.
- [ ] If the user denies microphone permission, nothing happens (no crash, no error UI).
- [ ] On successful reconnection, the button returns to the ready state.

### Cleanup
- [ ] Stopping recording releases the microphone at the OS level (mic indicator disappears).
- [ ] Navigating away or unmounting the component stops recording and releases all resources.
- [ ] WebSocket connections are closed when no longer needed.

### Configuration
- [ ] The mic button is hidden when no WhisperLiveKit URL is configured.
- [ ] The WhisperLiveKit URL is provided by the server via a configuration endpoint, not hardcoded in the client.

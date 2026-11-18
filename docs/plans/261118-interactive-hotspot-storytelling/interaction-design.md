# Visitor interaction

- A pointer tap or native button selects a published annotation by ID. A synthetic marker selects ordinary exhibit details. The scene retains its movement and multitouch rejection.
- A larger marker with an outline distinguishes the selected annotation at rest. Hover reveals the localized label and leaves selection and camera alone.
- The existing details panel puts the active label, body, progress and navigation near the top. The original exhibit description, image, audio, transcript, credits and links remain available in the same panel. Blank copy uses a localized unavailable message.
- Previous and Next follow the mapped order and stop at endpoints. The ordinary panel lets visitors choose a detail again. Escape closes a story first, then closes exhibit details and finally exits the scene. The original native trigger retains focus on selection and can regain it on story close.
- Keyboard buttons expose individual pressed states. A short polite announcement names the new selection and progress while the story body remains separately readable. Layout inherits the panel's neutral surfaces, wraps controls and uses 44-pixel targets.
- XR controller and gaze both use the existing target resolver. Real annotation hits update the in-headset text and reset its page. The headset pose remains device-owned. Ordinary exhibit selection and exit retain their current actions.

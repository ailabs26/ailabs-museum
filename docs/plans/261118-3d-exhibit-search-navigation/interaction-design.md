# Interaction design

Inherit Aura limestone/walnut/bronze HUD with Mantine controls. Compact search disclosure near room/catalogue controls. Search, guided controls, catalogue and hotspot disclosure stack in a content-sized, viewport-bounded scroll column. Multiple disclosures may remain open without overlapping each other; blank scene below the column stays interactive. Disclosure closes on successful arrival, and focus returns to the visible opener. Hotspot takeover closes search to reveal the story. A short status remains readable when collapsed. Mobile temporarily conceals the existing detail panel while search is expanded, preserving selection.

Search opens only on explicit action (no automatic mobile keyboard). Semantic list and buttons, labelled input, clear button, result count live region, Enter invokes first navigable result; Tab reaches every action. No listbox role or invented arrow interaction. Escape closes search before story/detail/tour; native fullscreen Escape remains browser-owned.

Match rings use static primitive geometry outside GLB, target uses a stronger broken ring. Minimap adds outline for match and double outline for target, distinct from selected fill. Clear query removes match outlines. No per-frame search, GLB cloning or postprocessing.

English and Vietnamese defaults with public translation keys. Other locales fall back to English for new controls. 2D links remain available for outside-room or blocked exhibits. HTML search is hidden while XR or WebGL recovery owns presentation.
